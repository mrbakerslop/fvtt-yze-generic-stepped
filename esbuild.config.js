import { build, context } from 'esbuild';
// import templatePaths from './tools/get-template-paths.js';

export default async ({ watch = false, production = false } = {}) => {
  const options = {
    bundle: true,
    entryPoints: ['./src/yzegs.js'],
    outdir: 'dist',
    format: 'esm',
    logLevel: 'info',
    sourcemap: !production ? 'inline' : false,
    ignoreAnnotations: !production,
    minifyWhitespace: true,
    minifySyntax: true,
    drop: production ? ['console', 'debugger'] : [],
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

  if (!watch) return build(options);

  const buildContext = await context(options);
  await buildContext.watch();
  return buildContext;
};
