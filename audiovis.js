/**
 * This script feeds raw audio visualization data from modified https://github.com/karlstav/cava
 * to 60 LEDs and filtering frequencies into low, mid, and upper range.
 */

var apa = require('./apa102.js')
var leds = new apa.APA(60, '/dev/spidev0.0');
var readline = require('readline');
var color = require('color');

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

leds.off();

for (var i = 0; i < 60; i++)
  leds.set(i, 255, 0, 0)

leds.sync();

rl.on('line', function(line){
  var nums = line.split(' ');
  // 1 to 60 is the correct numbers
  for (var i = 0; i < 60; i++) {
    var j = Math.min(255*3, Math.max(0, parseInt(nums[i+1]) - 10)*3);
    var j0 = Math.min(255, j);
    var j1 = Math.min(Math.max(0, j - 255), 255);
    var j2 = Math.min(Math.max(0, j - 255*2), 255);
    if (i <= 5 || i >= 54)   
      leds.set(i, j0, j1, j2);
    else if (i >=25 && i <= 34)
      leds.set(i, j2, j0, j1);
    else
      leds.set(i, j2, j1, j0);
  }
  leds.sync();
})


process.on('SIGINT', function () {
  leds.off();
  leds.close();
  process.exit();
})
