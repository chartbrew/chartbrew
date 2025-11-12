// Example PM2 ecosystem config for Chartbrew OS cluster mode
module.exports = {
  apps : [{
    name: "chartbrew-os",
    script    : "server/index.js",
    instances : "max",
    exec_mode : "cluster",
    env: {
      NODE_ENV: "production",
    }
  }]
}
