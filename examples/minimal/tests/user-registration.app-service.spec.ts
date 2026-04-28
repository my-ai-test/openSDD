/**
 * UserRegistrationAppService 单元测试（示例文件）
 * 测试来源：FD-01 spec AC-001, AC-003
 * 推导方法：从 AC 展开，不参考 AppService 实现代码
 *
 * 注意：本文件是演示用伪代码，展示 SDD 输出形态。
 * import 路径需按实际项目目录结构调整，
 * 类型定义需在项目中实现。
 */

// import 路径示例 — 按实际项目结构调整：
import { UserRegistrationAppService } from '../src/application/user-registration.app-service';
import { UserRepositoryPort } from '../src/domain/ports/user-repository.port';
import { IEventBus } from '../src/shared/event-bus.interface';
import { User, UserStatus } from '../src/domain/user.aggregate';

// ─── Mock 工厂 ────────────────────────────────────────────────────────────────

function makeUserRepo(overrides: Partial<UserRepositoryPort> = {}): jest.Mocked<UserRepositoryPort> {
  return {
    findByEmail: jest.fn().mockResolvedValue(null),     // 默认：邮箱未被注册
    findById: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<UserRepositoryPort>;
}

function makeEventBus(): jest.Mocked<IEventBus> {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    publishAll: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<IEventBus>;
}

function makeRegisterDto(overrides: Partial<{ email: string; password: string }> = {}) {
  return {
    email: overrides.email ?? 'alice@example.com',
    password: overrides.password ?? 'pass1234',
  };
}

// ─── 测试套件 ─────────────────────────────────────────────────────────────────

describe('UserRegistrationAppService', () => {
  let service: UserRegistrationAppService;
  let repo: jest.Mocked<UserRepositoryPort>;
  let eventBus: jest.Mocked<IEventBus>;

  beforeEach(() => {
    repo = makeUserRepo();
    eventBus = makeEventBus();
    service = new UserRegistrationAppService(repo, eventBus);
  });

  // ────── AC-001: 正常注册路径 ──────
  describe('register() — AC-001 正常注册路径', () => {
    it('L1: 有效数据 → 返回 userId，状态 PENDING_VERIFICATION', async () => {
      const result = await service.register(makeRegisterDto());

      expect(result.userId).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.status).toBe(UserStatus.PENDING_VERIFICATION);
    });

    it('L1: 注册成功 → 通过 EventBus 发布 UserRegisteredEvent', async () => {
      await service.register(makeRegisterDto());

      const published = (eventBus.publishAll as jest.Mock).mock.calls.flat(2);
      expect(published.some(e => e.constructor.name === 'UserRegisteredEvent')).toBe(true);
    });

    it('L1: 注册成功 → 调用 repo.save 持久化用户', async () => {
      await service.register(makeRegisterDto());

      expect(repo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ────── AC-003: 邮箱重复注册 ──────
  describe('register() — AC-003 邮箱重复', () => {
    it('L6: 邮箱已存在 → 抛出 emailAlreadyExists', async () => {
      // 模拟邮箱已被注册
      const existingUser = User.reconstitute({
        id: 'existing-001',
        email: 'alice@example.com',
        passwordHash: 'hash',
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
      });
      repo = makeUserRepo({ findByEmail: jest.fn().mockResolvedValue(existingUser) });
      service = new UserRegistrationAppService(repo, eventBus);

      await expect(service.register(makeRegisterDto())).rejects.toMatchObject({
        errorCode: 'errorcode.myapp.user.emailAlreadyExists',
      });
    });

    it('L6: 邮箱重复时 → 不调用 repo.save', async () => {
      repo = makeUserRepo({ findByEmail: jest.fn().mockResolvedValue({} as User) });
      service = new UserRegistrationAppService(repo, eventBus);

      await service.register(makeRegisterDto()).catch(() => {});

      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
