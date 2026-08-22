const loopbackAddresses = new Set(['127.0.0.1', '::1', 'localhost']);

export function assertDocumentCollaborationStartup(options: {
  address: string;
  authenticationReady: boolean;
  enabled: boolean;
  preparationMode: boolean;
}) {
  if (options.preparationMode) {
    if (!loopbackAddresses.has(options.address)) {
      throw new Error('协作准备模式只能绑定 loopback 地址');
    }
    return;
  }

  if (!options.enabled) {
    throw new Error('协作功能开关未启用');
  }

  if (!options.authenticationReady) {
    throw new Error('协作服务鉴权尚未实现，拒绝启动');
  }
}
