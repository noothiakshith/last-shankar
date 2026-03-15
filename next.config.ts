import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize TensorFlow.js Node and its dependencies to prevent webpack bundling
      config.externals = config.externals || [];
      config.externals.push({
        '@tensorflow/tfjs-node': 'commonjs @tensorflow/tfjs-node',
        '@mapbox/node-pre-gyp': 'commonjs @mapbox/node-pre-gyp',
        'mock-aws-s3': 'commonjs mock-aws-s3',
        'aws-sdk': 'commonjs aws-sdk',
        'nock': 'commonjs nock',
      });
    }
    
    // Ignore node-specific modules in client bundle
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },
  serverExternalPackages: ['@tensorflow/tfjs-node'],
};

export default nextConfig;
