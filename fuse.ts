import { fusebox, pluginLink } from 'fuse-box';
import * as fs from 'fs'
import { exec } from 'child_process'

const fuse = fusebox({
  entry: ['src/index.ts'],
  target: 'browser',
  devServer: true,
  webIndex: {
    template: './index.html'
  },
  sourceMap: {
    vendor: true,
    project: true,
    css: true,
  },
});

fuse.runDev()

exec('mkdir -p dist/js && cp -r src/audio-processors/processors.js dist/js/')

// I'm sure there's a way to do it with sparky (or whatever it is called)
// but I couldn't find a single example on how to do it in the whole
// fuse-box repo... sigh... So desperate times call for desperate measures ;)
fs.watch("src/audio-processors/processors.js", (eventType, filename) => {
  exec('mkdir -p dist/js && cp -r src/audio-processors/processors.js dist/js/')
});