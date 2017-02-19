/** 
 * APA102 module
 */

var SPI = require('spi')
var APA = function (n, device) {
  this.n = n
  this.device = new SPI.Spi(device, {
    'mode': SPI.MODE['MODE_0'],
    // The line below works for Raspberry Pi2, but not for NanoPi Neo Air
    // 'chipSelect': SPI.CS['none'],
    'maxSpeed': 20*1000*1000
  }, function (spi) {
    spi.open();
    console.log('opened spi');
  });

  // this only works for up to 64 leds
  // https://cpldcpu.wordpress.com/2014/11/30/understanding-the-apa102-superled/
  this.footer = new Buffer([0x11, 0x11, 0x11, 0x11]);
  this.header = new Buffer([0x00, 0x00, 0x00, 0x00]);
  
  this.leds = new Buffer(n * 4);
  this.off();
  
}
/** Range 0..31 */
APA.prototype.ledstart = function (brightness) {
  return (31 & brightness) | (7 << 5); 
}

APA.prototype.set = function (i, red, green, blue) {
  var k = (i % this.n) * 4;
  this.leds[k+3] = red;
  this.leds[k+1] = blue;
  this.leds[k+2] = green;
}

APA.prototype.setColor = function (i, color) {
  this.set(i, color.r, color.g, color.b);
}

APA.prototype.getColor = function (i) {
  var k = (i % this.n) * 4;
  return { r: this.leds[k+3], g: this.leds[k+2], b: this.leds[k+1] } 
}

APA.prototype.scale = function (coeff) {
  for (var i = 0; i < this.n; i++) {
    var k = i * 4;
    this.leds[k+3] = coeff * this.leds[k+3];
    this.leds[k+1] = coeff * this.leds[k+1];
    this.leds[k+2] = coeff * this.leds[k+2];
 } 
    
}

APA.prototype.brightness = function (i, b) {
  this.leds[(i % this.n) * 4] = this.ledstart(b);
}

APA.prototype.setAll = function (red, green, blue) {
  for (var i = 0; i < this.n; i++) 
    this.set(i, red, green, blue);
}

APA.prototype.brightnessAll = function (b) {
  var ledstart = this.ledstart(b);
  for (var i = 0; i < this.n; i++) {
    this.leds[i * 4] = ledstart
  }
}

APA.prototype.close = function () {
  console.log('closing spi');
  this.device.close();
}

APA.prototype.sync = function () {
  this.device.write(this.header);
  this.device.write(this.leds);
  this.device.write(this.footer);
}

APA.prototype.off = function () {
  // initialize bits to maximum brightness and black color
  this.leds.fill(0x00);
  var ledstart = this.ledstart(31); 
  for (var i = 0; i < this.n; i++) {
    this.leds[i * 4] = ledstart;
  }
  this.sync();
}

var color = require('color');

var Animations = {
  solid: function (led, state) {
    var c = state.color[0];
    led.setAll(c.r, c.g, c.b);
  },
  move: function (led, state) {
    if (! state.move) state.move = 0;
    led.scale(.9);
    led.setColor(state.move, state.color[0]);
    state.move = (state.move + 1) % led.n;
    return true;
  },
  sparkles: function (led, state) {
    var i = Math.floor(Math.random() * led.n);
    led.scale(.5);
    led.setColor(i, state.color[0]);
    return true;
  },
  rainbow: function (led, state) {
    if (! state.rainbow)
      state.rainbow = 1;

    for (var i = 0; i < led.n; i+=1)
      led.setColor(i, color({h: (state.rainbow + i) % 360, s: 100, v: 100}).rgb());

    state.rainbow = (state.rainbow +1) % 360;
 
    return true;
  },
  fire: function (led, state) {
    if (! state.fire)
      state.fire = new Fire(led);
    
    state.fire.animate();
    return true;
  },
}

/**
 * fire.js
 *
 * Fire by Mark Kriegsman, originally for the FastLED library
 *
 * see: https://github.com/FastLED/FastLED/blob/master/examples/Fire2012/Fire2012.ino
 *
 * LEDstrip plugin
 *
 * Copyright (c) 2013 Dougal Campbell
 *
 * Distributed under the MIT License
 */

function Fire (ledstrip) {
  this.ledstrip = ledstrip;
  this.ledstrip.off();
  this.NUM_LEDS = this.ledstrip.n;
  this.COOLING = 55;
  this.SPARKING = 120;
  this.heat = new Buffer(this.NUM_LEDS);
  this.heat.fill(0);
  return this;
}

// Replicate random8() function
Fire.prototype.random8 = function(min, max) {
  if (min === undefined) {
    min = 0;
    max = 255;
  }
  if (max === undefined) {
    max = min;
    min = 0;
  }
  return (Math.round(Math.random() * (max - min)) + min) & 255;
}

// Replicate random16() function
Fire.prototype.random16 = function(min, max) {
  if (min === undefined) {
    min = 0;
    max = 65535;
  }
  if (max === undefined) {
    max = min;
    min = 0;
  }
  return (Math.round(Math.random() * (max - min)) + min) & 65535;
}

Fire.prototype.qadd8 = function(a, b) {
  var tmp = Math.round(a + b);
  if (tmp > 255) tmp = 255;

  return tmp;
}

Fire.prototype.qsub8 = function(a, b) {
  var tmp = Math.round(a - b);
  if (tmp < 0) tmp = 0;

  return tmp;
}

Fire.prototype.scale8_video = function(val, min, max) {
  if (max === undefined) {
    max = min;
    min = 0;
  }

  return Math.floor(val * (max - min) / 255 + min);
}

Fire.prototype.animate = function() {
  // Step 1.  Cool down every cell a little
    for( var i = 0; i < this.NUM_LEDS; i++) {
      this.heat[i] = this.qsub8( this.heat[i],  this.random8(0, Math.floor((this.COOLING * 10) / this.NUM_LEDS) + 2));
    }
 
    // Step 2.  Heat from each cell drifts 'up' and diffuses a little
    for( var k = this.NUM_LEDS - 3; k > 0; k--) {
      this.heat[k] = Math.floor((this.heat[k - 1] + this.heat[k - 2] + this.heat[k - 2] ) / 3) || 0;
    }
   
    // Step 3.  Randomly ignite new 'sparks' of heat near the bottom
    if( this.random8() < this.SPARKING ) {
      var y = this.random8(7);
      this.heat[y] = this.qadd8( this.heat[y], this.random8(160,255) );
    }
 
    // Step 4.  Map from heat cells to LED colors
    for( var j = 0; j < this.NUM_LEDS; j++) {
        var color = this.HeatColor( this.heat[j]);
        this.ledstrip.set(j, color[0], color[1], color[2]);
    }
}

//Play with this for different strip colors
Fire.prototype.HeatColor = function(temperature) {
  var heatcolor = [0,0,0];
  if (temperature === undefined) {
    temperature = 0;
  }
 
  // Scale 'heat' down from 0-255 to 0-191,
  // which can then be easily divided into three
  // equal 'thirds' of 64 units each.
  var t192 = this.scale8_video( temperature, 192);
 
  // calculate a value that ramps up from
  // zero to 255 in each 'third' of the scale.
  var heatramp = t192 & 0x3F; // 0..63
  heatramp <<= 2; // scale up to 0..252
 
  // now figure out which third of the spectrum we're in:
  if( t192 & 0x80) {
    // we're in the hottest third
    heatcolor[0] = 255; // full red
    heatcolor[1] = 255; // full green
    heatcolor[2] = heatramp; // ramp up blue
   
  } else if( t192 & 0x40 ) {
    // we're in the middle third
    heatcolor[0] = 255; // full red
    heatcolor[1] = heatramp; // ramp up green
    heatcolor[2] = 0; // no blue
   
  } else {
    // we're in the coolest third
    heatcolor[0] = heatramp; // ramp up red
    heatcolor[1] = 0; // no green
    heatcolor[2] = 0; // no blue
  }
 
  return heatcolor;
}


module.exports = { 
  APA: APA,
  Animations: Animations
}

/** Main functions */

var leds = new APA(60, '/dev/spidev0.0');
var animation = {
  tick: undefined,
  state: {
    color: [],
  },
  timeout: 20,
  timer: undefined,
  update: function () {
    if (animation.timer) {
      clearTimeout(animation.timer);
      delete animation.timer;
    }

    if (typeof animation.tick == 'function') {
      if (animation.tick(leds, animation.state)) {
        animation.timer = setTimeout(animation.update, animation.timeout); 
      }
      leds.sync();
    } 
  }
}

leds.off()

var randomize = function() {
  // change main color
  animation.state.color[0] = color({h: (360 * Math.random()) % 360, s: 100, v: 100}).rgb();
  
  // play another sequence
  var keys = Object.keys(Animations)
  animation.tick = Animations[keys[keys.length * Math.random() << 0]];
  animation.update()
}

randomize()
setInterval(randomize, 10*60*1000)

process.on('SIGTERM', function() {
  leds.off()
  process.exit()
})
