const { createClient } = require('@supabase/supabase-js');
const fflate = require('fflate');
const { NodeIO } = require('@gltf-transform/core');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno locales
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan las credenciales de Supabase en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Lógica de extracción de BOM usando gltf-transform
async function extractBOMFromBinary(uint8Array) {
    const io = new NodeIO();
    const document = await io.readBinary(uint8Array);
    const root = document.getRoot();
    
    const bomMap = {};
    const scenes = root.listScenes();
    if (scenes.length === 0) return [];

    function traverse(node) {
        const mesh = node.getMesh();
        if (mesh) {
            const extras = node.getExtras() || {};
            // Identidad
            let partName = extras.PartNumber || extras.partNumber || extras.id || extras.name || node.getName();
            if (!partName || partName.trim() === '') {
                partName = mesh.getName() || 'Unnamed_Part';
            }
            
            // Limpieza estricta como en ViewerPage.jsx
            partName = partName.replace(/_\d+$/, '');
            partName = partName.replace(/[-_]?(Sólido|Solid|Sup|Body|Cuerpo|Mesh|Node)\s*\d*$/i, '');

            if (!bomMap[partName]) {
                bomMap[partName] = 0;
            }
            bomMap[partName] += 1;
        }
        node.listChildren().forEach(traverse);
    }

    scenes[0].listChildren().forEach(traverse);

    // Formatear al esquema de Supabase -> [{ id: "Pieza", qty: 4 }]
    const bomArray = Object.keys(bomMap).map(key => ({
        id: key,
        qty: bomMap[key]
    }));

    return bomArray;
}

async function migrate() {
    console.log("Iniciando migración de BOMs...");
    
    // 1. Obtener todos los ensamblajes
    const { data: assemblies, error } = await supabase.from('assemblies').select('*');
    if (error) {
        console.error("Error obteniendo ensamblajes:", error);
        return;
    }

    console.log(`Se encontraron ${assemblies.length} ensamblajes en la base de datos.`);

    for (const game of assemblies) {
        console.log(`\nProcesando ensamblaje: [${game.name}] (ID: ${game.id})`);
        
        try {
            let uint8Arr;

            if (!game.model_url) {
                console.log("No tiene modelo 3D asociado. Omitiendo...");
                continue;
            }

            // 2. Descargar el modelo
            if (game.model_url.startsWith('chunked://')) {
                const dataString = game.model_url.split('chunked://')[1];
                const [prefix, totalChunksStr] = dataString.split('|');
                const totalChunks = parseInt(totalChunksStr, 10);
                
                const chunks = [];
                let totalLength = 0;
                
                for (let i = 0; i < totalChunks; i++) {
                    const chunkName = `${prefix}.part${i}`;
                    const { data: chunkData, error: downloadError } = await supabase.storage.from('models').download(chunkName);
                    
                    if (downloadError) throw downloadError;
                    
                    const arrayBuffer = await chunkData.arrayBuffer();
                    const currentChunk = new Uint8Array(arrayBuffer);
                    chunks.push(currentChunk);
                    totalLength += currentChunk.length;
                }
                
                // Unir los fragmentos
                const combinedData = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                    combinedData.set(chunk, offset);
                    offset += chunk.length;
                }
                
                // Descomprimir
                console.log("  Descomprimiendo GZIP...");
                uint8Arr = fflate.gunzipSync(combinedData);
            } else {
                console.log("  Descargando URL directa...");
                const response = await fetch(game.model_url);
                const arrayBuffer = await response.arrayBuffer();
                uint8Arr = new Uint8Array(arrayBuffer);
            }

            // 3. Extraer BOM
            console.log("  Extrayendo BOM con @gltf-transform...");
            const newBomItems = await extractBOMFromBinary(uint8Arr);
            const oldBomCount = game.bom_items ? game.bom_items.length : 0;
            console.log(`  BOM extraído: ${newBomItems.length} componentes únicos (Antes tenía ${oldBomCount}).`);

            // 4. Actualizar Base de Datos
            const { error: updateError } = await supabase
                .from('assemblies')
                .update({ bom_items: newBomItems })
                .eq('id', game.id);

            if (updateError) throw updateError;
            console.log("  ✅ Base de datos actualizada con éxito.");

        } catch (err) {
            console.error(`  ❌ Error procesando el ensamblaje: ${err.message}`);
        }
    }
    
    console.log("\nMigración completada.");
}

migrate();
