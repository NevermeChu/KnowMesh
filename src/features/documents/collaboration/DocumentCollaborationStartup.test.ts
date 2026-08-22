import { describe, expect, it } from 'vitest';
import { assertDocumentCollaborationStartup } from './DocumentCollaborationStartup';

describe(assertDocumentCollaborationStartup, () => {
  it('rejects exposed preparation mode', () => {
    expect(() => {
      assertDocumentCollaborationStartup({
        address: '0.0.0.0',
        authenticationReady: false,
        enabled: false,
        preparationMode: true,
      });
    }).toThrow('协作准备模式只能绑定 loopback 地址');
  });

  it('rejects enabled service before authentication exists', () => {
    expect(() => {
      assertDocumentCollaborationStartup({
        address: '127.0.0.1',
        authenticationReady: false,
        enabled: true,
        preparationMode: false,
      });
    }).toThrow('协作服务鉴权尚未实现，拒绝启动');
  });
});
