/*!
 * pleasure-api-plugin-socket-io v1.0.0-beta
 * (c) 2018-2019 Martin Rafael Gonzalez <tin@devtin.io>
 * Released under the MIT License.
 */
import socketIo from 'socket.io';
import castArray from 'lodash/castArray';
import get from 'lodash/get';

let PleasureEntityMap;
let jwt;

const config = {
  getDeliveryGroup (auth) {
    return get(auth, 'level', '$global')
  }
};

const userGroups = ['$global'];
let io;

var pleasureApiPluginSocketIo = {
  name: 'io',
  config,
  init ({ pleasureEntityMap, pluginsApi, server, config, getConfig }) {
    // console.log(`init socket.io`)
    PleasureEntityMap = pleasureEntityMap;
    jwt = pluginsApi.jwt;

    const { prefix } = getConfig();
    const { getDeliveryGroup } = config;

    io = socketIo(server, { path: `${ prefix }-socket` });
    const unauthorized = new Error('unauthorized');

    io.use(async (socket, next) => {
      // wait until initialized
      if (!PleasureEntityMap) {
        // console.error(`socket connection before PleasureEntityMap`)
        return next(unauthorized)
      }

      let user;

      if (socket.handshake.headers['authorization']) {
        const jwtToken = socket.handshake.headers['authorization'].split(' ')[1];
        // console.log({ jwtToken })
        let valid = false;

        try {
          // console.log(`validating token....`)
          valid = await jwt.isValidSession(jwtToken);
          // console.log(`token is valid?`, valid)
        } catch (err) {
          // console.log(`error validating token!!!! ${ jwtToken }`, err.message)
        }

        if (!valid) {
          return next(unauthorized)
        }

        user = await jwt.verify(jwtToken);
        // next()
      }

      let userGroup;

      try {
        userGroup = getDeliveryGroup(user);
      } catch (err) {
        return next(err)
      }

      socket.join('$global');

      if (user) {
        // console.log(`socket:io connecting`, `$user-${ user._id }`)
        socket.join(`$user-${ user._id }`);
      }

      if (userGroup) {
        castArray(userGroup).forEach(group => {
          if (userGroups.indexOf(group) < 0) {
            userGroups.push(group);
          }
          socket.join(group);
        });
      }

      // console.log(`receiving socket.io connection!`)
      return next()
    });
  },
  methods: {
    getUserGroups () {
      return userGroups
    },
    notify (userId, event, payload) {
      return io.to(`$user-${ userId }`).emit(event, payload)
    },
    socketIo () {
      // this scope should have a bunch of sugar to access different parts of the api
      // since here is where most of the logic is gonna be written
      return io
    }
  }
};

export default pleasureApiPluginSocketIo;
