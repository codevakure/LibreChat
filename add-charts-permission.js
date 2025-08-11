const path = require('path');
const { loadDefaultInterface } = require('./api/server/services/start/interface');

// This script manually adds CHARTS permission to existing roles
async function addChartsPermission() {
  try {
    // Load the default interface to trigger permission updates
    await loadDefaultInterface(undefined, { interface: { charts: true } });
    console.log('Charts permission added successfully');
  } catch (error) {
    console.error('Error adding charts permission:', error);
  }
}

addChartsPermission();
