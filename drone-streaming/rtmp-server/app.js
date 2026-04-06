const NodeMediaServer = require('node-media-server');
require('dotenv').config();

const config = {
  rtmp: {
    port: process.env.RTMP_PORT || 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: process.env.HTTP_PORT || 8000,
    allow_origin: '*',
    mediaroot: './media'
  },
  auth: {
    api: true,
    api_user: 'admin',
    api_pass: process.env.API_PASS || 'admin123',
    publish: false,   // set true + secret on EC2
    play: false
  },
  trans: {
    ffmpeg: '/usr/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        hlsKeep: false
      }
    ]
  },
  logType: 3
};

const nms = new NodeMediaServer(config);
nms.run();

nms.on('postPublish', (id, StreamPath) => {
  console.log(`🔴 LIVE: ${StreamPath}`);
});
nms.on('donePublish', (id, StreamPath) => {
  console.log(`⬛ DONE: ${StreamPath}`);
});

console.log(`🚀 RTMP : rtmp://0.0.0.0:${process.env.RTMP_PORT || 1935}/live/<stream>`);
console.log(`🌐 HLS  : http://0.0.0.0:${process.env.HTTP_PORT || 8000}/live/<stream>/index.m3u8`);
console.log(`📡 API  : http://0.0.0.0:${process.env.HTTP_PORT || 8000}/api/streams`);
