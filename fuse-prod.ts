import { fusebox, pluginLink } from 'fuse-box';

const fuse = fusebox({
  entry: ['src/index.ts'],
  target: 'browser',
  webIndex: {
    template: './index.html',
    publicPath: './',
  },
  sourceMap: false,
});

fuse.runProd()

// const fuse2 = fusebox({
//   entry: ['src/sound-processor.ts'],
//   compilerOptions: {

//   }
//   target: 'browser',
//   devServer: false,
//   webIndex: false,
//   sourceMap: {
//     vendor: false,
//     project: true,
//   },
// });

// fuse2.runDev({ bundles: { distRoot: 'dist/', app: 'sound-processor.js' } })

// fuse.runDev({
//   bundles: {
//     app: './app.$hash.js',
//     vendor: './vendor.$hash.js',
//     mapping: [
//       { matching: 'sound-processor*', target: 'sound-processor.js' },
//     ]
//   },  
// });
