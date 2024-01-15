import { Test, TestingModule } from '@nestjs/testing';
import { AppGateway, CreateGame } from '../app.gateway';
import * as io from 'socket.io';

describe('@AppGateway', () => {
  let appGateway: AppGateway;
  let mockSocket: io.Socket;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppGateway],
    }).compile();

    appGateway = module.get<AppGateway>(AppGateway);
    mockSocket = {} as io.Socket;
  });

  it('should be defined', () => {
    expect(appGateway).toBeDefined();
  });

  it('should handle createGame event', () => {
    const createGameData: CreateGame = { boardSize: 5 };

    const result = appGateway.handleCreateGameEvent(createGameData, mockSocket);

    expect(result).toBeDefined();
  });
});
