module.exports = {
  MAP_FILE: "challenge_21", // options are 'default_map' (DEFAULT), 'empty_map', 'map_20', ...files in levels/maps

  PARCELS_GENERATION_INTERVAL: "1s", // options are '1s', '2s' (DEFAULT), '5s', '10s'
  PARCELS_MAX: "10", // 'infinite' (DEFAULT)

  MOVEMENT_STEPS: 1, // default is 1
  MOVEMENT_DURATION: 500, // default is 500
  AGENTS_OBSERVATION_DISTANCE: 2, // default is 5
  PARCELS_OBSERVATION_DISTANCE: 5, // default is 5
  AGENT_TIMEOUT: 10000, // default is 10000

  PARCEL_REWARD_AVG: 10, // default is 30
  PARCEL_REWARD_VARIANCE: "0", // default is 10
  PARCEL_DECADING_INTERVAL: "infinite", // options are '1s', '2s', '5s', '10s', 'infinite' (DEFAULT)

  RANDOMLY_MOVING_AGENTS: 10, // default is 2
  RANDOM_AGENT_SPEED: "1s", // options are '1s', '2s' (DEFAULT), '5s', '10s'

  CLOCK: 50, // default is 50 (50ms are 20frame/s)
};
