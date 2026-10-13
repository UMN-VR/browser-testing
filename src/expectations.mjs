import legacy from './legacy-expectations.json' with { type: 'json' };

/** Measured public legacy facts, retained as assertion inputs, never runtime content. */
export const LEGACY = legacy;
export const CAMPUS_ROUTES = Object.freeze([
  { id: 'selector', path: '/tour/', sceneId: null, count: 0 },
  { id: 'minneapolis', path: '/tour/minneapolis/', sceneId: 'umn-minneapolis', count: 48 },
  { id: 'st-paul', path: '/tour/st-paul/', sceneId: 'umn-st-paul', count: 12 },
  { id: 'twin-cities', path: '/tour/twin-cities/', sceneId: 'umn-twin-cities', count: 60 },
]);
export const CAMPUS_TAB_IDS = Object.freeze([
  'location', 'controls', 'interface', 'settings', 'map', 'renderer', 'sky', 'time',
  'scenes', 'about', 'bug-report', 'panorama', 'panorama-settings',
]);
export const CROSS_CAMPUS_DIRECTIONS = Object.freeze([
  { source: 'regis-center-for-art-gallery', link: 'next-stop', target: 'saint-paul-campus', route: '/tour/st-paul/' },
  { source: 'saint-paul-campus', link: 'previous-stop', target: 'regis-center-for-art-gallery', route: '/tour/minneapolis/' },
  { source: 'community-connections', link: 'next-stop', target: 'recreation-and-wellness-center', route: '/tour/minneapolis/' },
  { source: 'recreation-and-wellness-center', link: 'previous-stop', target: 'community-connections', route: '/tour/st-paul/' },
]);
export const SHARED_HELPER = Object.freeze({
  package: '@foss-earth/browser-testing',
  revision: 'd63ca6e46d94dc90635f3da4b9d73a741347f026',
  archiveSha256: 'bfe6ed4839321420e098688b02de2995e7ae8bc19fd0c66e421eacce9039b5d9',
  archiveSizeBytes: 115283,
  descriptorSha256: 'd758849addb9eb7264702e4466c899a80931589319cd7cec47d0935c77af9732',
});
