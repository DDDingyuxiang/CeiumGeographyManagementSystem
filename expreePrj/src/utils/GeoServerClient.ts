import axios, { AxiosInstance } from 'axios';

export class GeoServerClient {
  private client: AxiosInstance;
  public baseUrl: string;

  constructor(baseUrl: string, user?: string, password?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
    this.client = axios.create({
      baseURL: this.baseUrl + '/rest',
      auth: {
        username: user || 'admin',
        password: password || 'geoserver',
      },
      headers: {
        'Content-Type': 'application/xml', // GeoServer REST 默认偏好 XML
      },
    });
  }

  // 模拟 .workspaces.create()
  public workspaces = {
    exists: async (name: string) => {
      try {
        const res = await this.client.get(`/workspaces/${name}.json`);
        return res.status === 200;
      } catch { return false; }
    },
    create: async (name: string) => {
      const xml = `<workspace><name>${name}</name></workspace>`;
      return this.client.post('/workspaces', xml);
    }
  };

  // 模拟 .coveragestores.create() - 针对 TIFF
  public coveragestores = {
    create: async (ws: string, data: { name: string; type: string; url: string }) => {
      const xml = `<coverageStore>
        <name>${data.name}</name>
        <type>${data.type}</type>
        <enabled>true</enabled>
        <workspace>${ws}</workspace>
        <url>${data.url}</url>
      </coverageStore>`;
      return this.client.post(`/workspaces/${ws}/coveragestores`, xml);
    },
    delete: async (ws: string, name: string) => {
    // 尝试删除栅格仓库
    const coverageUrl = `/workspaces/${ws}/coveragestores/${name}?recurse=true`;
    // 尝试删除矢量仓库 (防错路径)
    const dataUrl = `/workspaces/${ws}/datastores/${name}?recurse=true`;

    try {
      return await this.client.delete(coverageUrl);
    } catch (e: any) {
      if (e.response?.status === 404) {
        console.log(`栅格路径未找到，尝试矢量路径: ${dataUrl}`);
        return await this.client.delete(dataUrl);
      }
      throw e;
    }
  }
  };

  // 模拟 .coverages.publish()
  public coverages = {
  publish: async (ws: string, store: string, data: { name: string }) => {
    // 移除 nativeName，由 GeoServer 自动关联 Store 中的资源
    // 确保没有多余的空格或非法字符
    const xml = `<coverage><name>${data.name}</name><title>${data.name}</title><srs>EPSG:4326</srs></coverage>`;
    
    return this.client.post(
      `/workspaces/${ws}/coveragestores/${store}/coverages`, 
      xml,
      { headers: { 'Content-Type': 'application/xml' } }
    );
  },
  delete: async (ws: string, store: string, name: string) => {
    return this.client.delete(`/workspaces/${ws}/coveragestores/${store}/coverages/${name}?recurse=true`);
  }
};

  // GeoServerClient.ts - 确认已有方法
public datastores = {
    exists: async (ws: string, name: string) => {
        try {
            const res = await this.client.get(`/workspaces/${ws}/datastores/${name}.json`);
            return res.status === 200;
        } catch {
            return false;
        }
    },

    create: async (ws: string, data: { name: string; url: string; charset?: string }) => {
        const xml = `<dataStore>
            <name>${data.name}</name>
            <type>Shapefile</type>
            <enabled>true</enabled>
            <connectionParameters>
                <entry key="url">${data.url}</entry>
                <entry key="charset">${data.charset || 'UTF-8'}</entry>
                <entry key="create spatial index">true</entry>
                <entry key="namespace">${ws}</entry>
            </connectionParameters>
        </dataStore>`;
        return this.client.post(`/workspaces/${ws}/datastores`, xml, {
            headers: { 'Content-Type': 'application/xml' }
        });
    },

    publish: async (ws: string, store: string, name: string) => {
        const xml = `<featureType>
            <name>${name}</name>
            <title>${name}</title>
            <srs>EPSG:4326</srs>
            <enabled>true</enabled>
        </featureType>`;
        return this.client.post(`/workspaces/${ws}/datastores/${store}/featuretypes`, xml, {
            headers: { 'Content-Type': 'application/xml' }
        });
    },

    delete: async (ws: string, name: string) => {
        return this.client.delete(`/workspaces/${ws}/datastores/${name}?recurse=true`);
    }
};
}
