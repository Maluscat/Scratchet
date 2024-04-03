import type { SocketRoom } from 'SocketRoom';
import type { SocketUser } from 'SocketUser';
import type { Context } from 'oak';

import { ServerSocketBase } from 'ServerSocketBase';
import { Controller } from 'Controller';
import { app, router } from 'router';


interface ReceivedEventInterfaceStructure {
  [key: string]: {
    required: {
      [key: string]: string;
    };
    fn?: (socketUser: SocketUser, val?: any, socketRoom?: SocketRoom) => void;
    /** Bypasses check whether the user is active. */
    init?: boolean,
    passOn?: boolean;
  }
}

// NOTE values with `passOn` MUST have a required room - This is not validated
export const receivedEventsInterface: ReceivedEventInterfaceStructure = {
  connectInit: {
    required: {
      val: 'object'
    },
    fn: (socketUser, val) => {
      controller.initializeUserConnection(socketUser, val!);
    },
    init: true,
  },
  joinRoom: {
    required: {
      val: 'object'
    },
    fn: (socketUser, val) => {
      controller.userJoinRoomFromRoomCode(socketUser, val!);
    }
  },
  newRoom: {
    required: {
      val: 'object'
    },
    fn: (socketUser, val) => {
      controller.addNewRoom(socketUser, val!);
    }
  },
  leave: {
    required: {
      room: 'number'
    },
    fn: (socketUser, val, socketRoom) => {
      controller.removeUserFromRoom(socketUser, socketRoom!);
    },
    passOn: true
  },
  changeName: {
    required: {
      val: 'string',
      room: 'number'
    },
    fn: (socketUser, val, socketRoom) => {
      socketUser.setNameForRoom(socketRoom!, val!);
    },
    passOn: true
  },
  changeRoomName: {
    required: {
      val: 'string',
      room: 'number'
    },
    fn: (socketUser, val, socketRoom) => {
      // Does not care which user it came from: Everyone can rename it
      socketRoom!.setName(val!);
    },
    passOn: true
  },
  clearUser: {
    required: {
      room: 'number'
    },
    passOn: true
  },
};


export const controller = new Controller();


router
  .get('/socket', (ctx: Context) => {
    const socket = new ServerSocketBase(ctx.upgrade());
    controller.registerSocket(socket, ctx.request);
  });

await app.listen({ port: 8002 });
