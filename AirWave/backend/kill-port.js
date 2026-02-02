const find = require('find-process');
const { exec } = require('child_process');

const ports = [3000, 3001, 8501];

async function killPorts() {
  for (const port of ports) {
    try {
      const list = await find('port', port);
      if (list.length > 0) {
        console.log(`🔪 Killing process on port ${port}...`);
        for (const p of list) {
          exec(`kill -9 ${p.pid}`, (err) => {
            if (err) {
              console.error(`Failed to kill process ${p.pid}:`, err.message);
            } else {
              console.log(`✅ Killed process ${p.pid} on port ${port}`);
            }
          });
        }
      }
    } catch (err) {
      // Port is free
    }
  }
  // Give it a moment to clean up
  await new Promise(resolve => setTimeout(resolve, 500));
}

killPorts().catch(console.error);

