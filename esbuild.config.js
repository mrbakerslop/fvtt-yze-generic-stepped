import { build, context } from 'esbuild';
// import templatePaths from './tools/get-template-paths.js';

export function getBuildOptions({ production = false } = {}) {
  return {
    bundle: true,
    entryPoints: ['./src/yzegs.js'],
    outdir: 'dist',
    format: 'esm',
    logLevel: 'info',
    sourcemap: !production ? 'inline' : false,
    ignoreAnnotations: !production,
    minifyWhitespace: true,
    minifySyntax: true,
    // Keep warnings and errors in production so failed hooks and migrations remain diagnosable.
    drop: production ? ['debugger'] : [],
    pure: production ? ['console.log', 'console.debug'] : [],
    // define: {
    //   PATHS: JSON.stringify(templatePaths),
    // },
    // plugins: [
    //   sassPlugin({
    //     logger: {
    //       warn: () => '',
    //     },
    //   }),
    //   {
    //     name: 'external-files',
    //     setup(inBuild) {
    //       inBuild.onResolve({ filter: /(\.\/assets|\.\/fonts|\/systems)/ }, () => {
    //         return { external: true };
    //       });
    //     },
    //   },
    // ],
  };
}

export default async ({ watch = false, production = false } = {}) => {
  const options = getBuildOptions({ production });

  if (!watch) return build(options);

  const buildContext = await context(options);
  await buildContext.watch();
  return buildContext;
};
