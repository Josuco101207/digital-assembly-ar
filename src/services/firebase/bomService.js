import { db } from './config';
import { collection, getDocs } from 'firebase/firestore';

export const fetchMaterialsBOM = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'materials_bom'));
    
    // Transform array into an object mapped by id
    const bomMap = {};
    querySnapshot.forEach((doc) => {
      const item = doc.data();
      bomMap[doc.id] = {
        name: item.name,
        type: item.type,
        dimensions: item.dimensions,
        material: item.material,
        weight: item.weight,
        // You can add more fields if needed
      };
    });

    return bomMap;
  } catch (error) {
    console.error("Error fetching BOM:", error);
    throw error;
  }
};
