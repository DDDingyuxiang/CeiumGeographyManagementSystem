declare namespace NodeJS {
  interface ProcessEnv {
    JWT_SECRET: string;
  }
}
declare module 'geoserver-node-client' {
  const GeoServer: any;
  export default GeoServer;
}