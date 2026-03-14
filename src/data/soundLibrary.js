import bonusMp3 from '../assets/sounds/bonus.mp3';
import coinMp3 from '../assets/sounds/coin.mp3';
import jumpMp3 from '../assets/sounds/jump.mp3';

export const soundOptions = [
  { value: 'jump', label: 'jump' },
  { value: 'coin', label: 'coin' },
  { value: 'bonus', label: 'bonus' },
];

export const soundFileByName = {
  jump: jumpMp3,
  coin: coinMp3,
  bonus: bonusMp3,
  HumanBeatbox1: bonusMp3,
  'Human Beatbox1': bonusMp3,
};

export const soundCredits = [
  {
    value: 'jump',
    title: 'Player jumping in a video game',
    sourcePage: 'https://mixkit.co/free-sound-effects/jump/',
    fileUrl: 'https://assets.mixkit.co/active_storage/sfx/2043/2043-preview.mp3',
    licenseName: 'Mixkit Sound Effects Free License',
    licenseUrl: 'https://mixkit.co/license/',
  },
  {
    value: 'coin',
    title: 'Game treasure coin',
    sourcePage: 'https://mixkit.co/free-sound-effects/player/',
    fileUrl: 'https://assets.mixkit.co/active_storage/sfx/2038/2038-preview.mp3',
    licenseName: 'Mixkit Sound Effects Free License',
    licenseUrl: 'https://mixkit.co/license/',
  },
  {
    value: 'bonus',
    title: 'Arcade video game bonus',
    sourcePage: 'https://mixkit.co/free-sound-effects/player/',
    fileUrl: 'https://assets.mixkit.co/active_storage/sfx/2044/2044-preview.mp3',
    licenseName: 'Mixkit Sound Effects Free License',
    licenseUrl: 'https://mixkit.co/license/',
  },
];
