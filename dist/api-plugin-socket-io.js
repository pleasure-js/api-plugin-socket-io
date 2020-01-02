/*!
 * @pleasure-js/api-plugin-socket-io v1.0.0-beta
 * (c) 2018-2020 Martin Rafael Gonzalez <tin@devtin.io>
 * Released under the MIT License.
 */
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var socketIo = _interopDefault(require('socket.io'));
var castArray = _interopDefault(require('lodash/castArray'));
var get = _interopDefault(require('lodash/get'));
var utils = require('@pleasure-js/utils');

let PleasureEntityMap;
let jwt;

const config = {
  getDeliveryGroup (auth) {
    return get(auth, 'level', '$global')
  }
};

const userGroups = ['$global'];
let io;

var apiPluginSocketIo = {
  name: 'io',
  config,
  prepare ({ pleasureEntityMap, pluginsApi, server, config, getConfig }) {
    const { debug } = utils.getConfig();

    PleasureEntityMap = pleasureEntityMap;
    jwt = pluginsApi.jwt;

    const { prefix } = getConfig();
    const { getDeliveryGroup } = config;

    io = socketIo(server, { path: `${ prefix }-socket` });
    const unauthorized = new Error('unauthorized');

    io.use(async (socket, next) => {
      // wait until initialized
      if (!PleasureEntityMap) {
        console.error(`Attempting to connect to socket before API ready (PleasureEntityMap)`);
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
          console.log(`error validating token!!!! ${ jwtToken }`, err.message);
        }

        if (!valid) {
          console.log(`invalid token`, jwtToken);
          return next(unauthorized)
        }

        user = await jwt.verify(jwtToken);
        // next()
      }

      let userGroup;

      try {
        userGroup = getDeliveryGroup(user);
      } catch (err) {
        console.log(`error getting delivery group`, err);
        return next(err)
      }

      socket.join('$global');

      if (user) {
        debug && console.log(`socket:io connecting`, `$user-${ user._id }`);
        socket.join(`$user-${ user._id }`);
      }

      if (userGroup) {
        castArray(userGroup).forEach(group => {
          if (userGroups.indexOf(group) < 0) {
            userGroups.push(group);
          }
          debug && console.log(`socket.join`, group);
          socket.join(group, () => {
            debug && console.log(`socket rooms ${ socket.id }`, Object.keys(socket.rooms));
          });
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

module.exports = apiPluginSocketIo;
