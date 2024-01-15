import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';

import * as io from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { faker } from '@faker-js/faker';
import * as _ from 'lodash';

const colors = [
  'red',
  'blue',
  'green',
  'yellow',
  'purpule',
  'black',
  'brown',
  'grey',
  'orange',
];

export interface Game {
  id: string;
  clients: {
    userId: string;
    socket: io.Socket;
  }[];
  avaliableColors: string[];
  boardSize: number;
  boardState: string[];
  users: Record<string, any>[];
  secondsLeft: number;
  started: boolean;
  stopped: boolean;
  winner: Record<string, any>;
}

const games = new Map<string, Game>();
const socketsInGames = new Map<string, string>();

export interface CreateGame {
  boardSize: number;
}

export interface Click {
  gameId: string;
  index: number;
  userId: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AppGateway implements OnGatewayDisconnect {
  handleDisconnect(socket: io.Socket) {
    const gameId = socketsInGames.get(socket.id);
    const game = games.get(gameId);

    if (!game) {
      return;
    }

    const { clients } = game;

    const index = clients.findIndex((client) => client.socket.id === socket.id);
    clients.splice(index, 1);
  }

  @SubscribeMessage('rejoinGame')
  handlereJoinEvent(
    @MessageBody() data: { user: Record<string, any>; gameId: string },
    @ConnectedSocket() socket: io.Socket,
  ) {
    const { user, gameId } = data;
    socketsInGames.set(socket.id, gameId);

    const game = games.get(gameId);

    if (!game) {
      return;
    }

    game.clients.push({ userId: user.userId, socket });

    return { game: _.omit(game, 'clients'), user };
  }

  @SubscribeMessage('joinGame')
  handleJoinEvent(
    @MessageBody() data: { gameId: string; user: Record<string, any> },
    @ConnectedSocket() socket: io.Socket,
  ) {
    const { gameId } = data;
    socketsInGames.set(socket.id, gameId);

    const game = games.get(gameId);
    const { clients } = game;

    let user = data.user;
    if (!user) {
      user = this.createUserForGame(game);
      game.users.push(user);
    }

    game.clients.push({ userId: user.userId, socket });

    clients.forEach(({ socket }) => {
      socket.emit('joined', _.omit(game, 'clients'));
    });

    return { game: _.omit(game, 'clients'), user };
  }

  @SubscribeMessage('click')
  handleClickEvent(@MessageBody() data: Click) {
    const { gameId, index, userId } = data;

    const game = games.get(gameId);
    const { boardState, clients } = game;

    boardState[index] = userId;

    clients.forEach(({ socket }) => {
      socket.emit('clicked', _.omit(game, 'clients'));
    });
  }

  @SubscribeMessage('connection')
  handleConnectionEvent() {
    console.log('connection');
  }

  @SubscribeMessage('createGame')
  handleCreateGameEvent(
    @MessageBody() data: CreateGame,
    @ConnectedSocket() socket: io.Socket,
  ) {
    const { boardSize } = data;
    const game = this.createGame(boardSize);
    socketsInGames.set(socket.id, game.id);

    const user = this.createUserForGame(game, true);
    game.users.push(user);
    game.clients.push({ userId: user.userId, socket });

    games.set(game.id, game);

    return _.omit(game, 'clients');
  }

  @SubscribeMessage('startGame')
  handleStartGameEvent(
    @MessageBody() data: { gameId: string },
    @ConnectedSocket() socket: io.Socket,
  ) {
    const { gameId } = data;
    const game = games.get(gameId);

    const { userId } = game.clients.find(
      (client) => client.socket.id === socket.id,
    );

    const user = game.users.find((user) => user.userId === userId);

    if (!user.owner) {
      throw new Error('Not allowed');
    }

    game.started = true;

    const interval = setInterval(() => {
      game.secondsLeft--;

      if (game.secondsLeft <= 0) {
        game.stopped = true;

        const winner = this.getWinner(game);
        game.winner = winner;

        clearInterval(interval);
      }

      game.clients.forEach(({ socket }) => {
        socket.emit('gameUpdate', _.omit(game, 'clients'));
      });
    }, 1000);
  }

  private getWinner(game: Game) {
    const { users, boardState } = game;

    const userIdsCount: Record<string, number> = {};

    boardState.forEach((userId) => {
      userIdsCount[userId] = (userIdsCount[userId] || 0) + 1;
    });

    const maxCount = Math.max(...Object.values(userIdsCount));
    const winnersIds = Object.keys(userIdsCount).filter(
      (userId) => userIdsCount[userId] === maxCount,
    );

    if (winnersIds.length > 1) {
      return null;
    }

    return users.find(({ userId }) => userId === winnersIds[0]);
  }

  private createGame(boardSize: number): Game {
    return {
      id: uuidv4(),
      clients: [],
      avaliableColors: [...colors],
      boardSize,
      boardState: Array(boardSize * boardSize),
      users: [],
      secondsLeft: 30,
      started: false,
      stopped: false,
      winner: null,
    };
  }

  private createUserForGame(game: Game, owner = false) {
    const { avaliableColors } = game;

    return {
      userId: uuidv4(),
      userName: faker.person.fullName(),
      color: avaliableColors.shift(),
      owner,
    };
  }
}
