import { GeoServerClient } from '../utils/GeoServerClient.js';
import dotenv from 'dotenv';

dotenv.config();
const url = process.env.GEOSERVER_URL || 'http://localhost:8080/geoserver';
const user = process.env.GEOSERVER_USER || 'admin';
const password = process.env.GEOSERVER_PASSWORD || 'geoserver';

const gsClient = new GeoServerClient    (
    url,
    user,
    password,
);

export const Gs_Client = {
    client: gsClient,
    workspace: process.env.GEOSERVER_WORKSPACE,
    baseUrl: url,
};

