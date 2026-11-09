import { BoardTagMeta } from '../types';

export const BOARD_TAGS: BoardTagMeta[] = [
  {
    id: 'szukam',
    label: 'Szukam / Przygarnę',
    icon: 'magnify',
    color: '#0284C7',
    bgColor: '#E0F2FE',
  },
  {
    id: 'oddam',
    label: 'Oddam drobiazgi',
    icon: 'gift-outline',
    color: '#059669',
    bgColor: '#D1FAE5',
  },
  {
    id: 'pomoc',
    label: 'Pomoc sąsiedzka',
    icon: 'hand-heart-outline',
    color: '#7C3AED',
    bgColor: '#EDE9FE',
  },
  {
    id: 'info',
    label: 'Informacja / Alert',
    icon: 'bullhorn-outline',
    color: '#F78F00',
    bgColor: '#FFF7ED',
  },
  {
    id: 'inne',
    label: 'Inne ogłoszenie',
    icon: 'message-outline',
    color: '#475569',
    bgColor: '#F1F5F9',
  },
];
