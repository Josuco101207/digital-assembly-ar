import { supabase } from './config';

export const fetchMaterialsBOM = async () => {
  const { data, error } = await supabase
    .from('materials_bom')
    .select('*');

  if (error) {
    console.error("Error fetching BOM:", error);
    throw error;
  }

  // Transform array into an object mapped by id (just like the old Firebase logic)
  const bomMap = {};
  data.forEach(item => {
    bomMap[item.id] = {
      name: item.name,
      type: item.type,
      dimensions: item.dimensions,
      material: item.material,
      weight: item.weight,
      // You can add more fields if needed
    };
  });

  return bomMap;
};
