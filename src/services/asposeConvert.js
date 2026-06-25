/**
 * Servicio para gestionar la conversión de SketchUp (.skp) a .glb usando Aspose.3D Cloud API.
 * Realiza las operaciones directo desde el navegador para evitar límites de tamaño en Vercel.
 */

export const convertSkpToGlb = async (file, onProgress) => {
  try {
    onProgress?.('Autenticando de forma segura...');

    // 1. Obtener Token de Aspose desde nuestro backend
    const tokenRes = await fetch('/api/aspose-token');
    if (!tokenRes.ok) throw new Error('No se pudo obtener el token de conversión');
    
    const { access_token } = await tokenRes.json();
    if (!access_token) throw new Error('Token inválido');

    // 2. Subir el archivo original (.skp) al almacenamiento de Aspose
    onProgress?.('Subiendo archivo .skp a la nube...');
    // Generar un nombre seguro sin espacios
    const safeName = `temp_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    // Necesitamos usar FormData nativo para enviar el archivo
    const formData = new FormData();
    formData.append('File', file, safeName);

    const uploadRes = await fetch(`https://api.aspose.cloud/v3.0/3d/storage/file/${safeName}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${access_token}`
      },
      body: formData
    });

    if (!uploadRes.ok) {
      console.error('Upload Error:', await uploadRes.text());
      throw new Error('Falló la subida del archivo a la nube');
    }

    // 3. Solicitar la conversión a GLB
    onProgress?.('Convirtiendo a GLB (esto puede tardar unos segundos)...');
    const outFileName = safeName.replace('.skp', '.glb');

    const convertRes = await fetch(`https://api.aspose.cloud/v3.0/3d/saveas/newformat?name=${safeName}&newformat=glb&newfilename=${outFileName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!convertRes.ok) {
      console.error('Convert Error:', await convertRes.text());
      throw new Error('El motor falló al procesar la geometría del .skp');
    }

    // 4. Descargar el archivo .glb resultante
    onProgress?.('Descargando el modelo optimizado...');
    const downloadRes = await fetch(`https://api.aspose.cloud/v3.0/3d/storage/file/${outFileName}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!downloadRes.ok) {
      throw new Error('No se pudo descargar el archivo convertido');
    }

    const blob = await downloadRes.blob();

    // 5. Limpieza (opcional pero recomendada para no saturar los 150 creditos/espacio)
    // Se ejecuta de fondo sin bloquear al usuario
    fetch(`https://api.aspose.cloud/v3.0/3d/storage/file/${safeName}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${access_token}` }
    }).catch(e => console.log('Clean up skip', e));

    fetch(`https://api.aspose.cloud/v3.0/3d/storage/file/${outFileName}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${access_token}` }
    }).catch(e => console.log('Clean up skip', e));

    // Devolver un ObjectURL listo para ser consumido por el visor
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error('Error convirtiendo SKP:', error);
    throw error;
  }
};
