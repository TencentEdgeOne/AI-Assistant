import originalExport from './next.config.original.mjs';

let config;
if (typeof originalExport === 'function') {
  const origFn = originalExport;
  config = (...args) => {
    const resolved = origFn(...args);
    if (resolved && typeof resolved.then === 'function') {
      return resolved.then((c) => {
        c.images = { ...c.images, loader: 'custom', loaderFile: './.edgeone/image-loader.mjs' };
        return c;
      });
    }
    resolved.images = { ...resolved.images, loader: 'custom', loaderFile: './.edgeone/image-loader.mjs' };
    return resolved;
  };
} else {
  config = { ...originalExport };
  config.images = { ...config.images, loader: 'custom', loaderFile: './.edgeone/image-loader.mjs' };
}

export default config;
