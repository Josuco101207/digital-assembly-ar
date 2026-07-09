export const checkInventory = async (bomItems) => {
  // Simular latencia de red del ERP
  await new Promise(resolve => setTimeout(resolve, 1500));

  const inventory = {};
  
  bomItems.forEach(item => {
    // 80% probabilidad de tener stock completo, 20% probabilidad de faltante
    const hasFullStock = Math.random() > 0.2;
    
    if (hasFullStock) {
      // Simular que tenemos más o igual al requerido
      inventory[item.name] = item.quantity + Math.floor(Math.random() * 50);
    } else {
      // Simular un faltante
      inventory[item.name] = Math.max(0, item.quantity - Math.floor(Math.random() * item.quantity + 1));
    }
  });

  return inventory;
};
