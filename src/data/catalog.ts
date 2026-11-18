import type { Exercise, WorkoutTemplate } from '../core/types';

export const EXERCISES: Exercise[] = [
  { id: 'v_squat', name: 'V-Squat', primary: 'quads', secondary: ['glutes'], equipment: 'machine', shoulderFriendly: true, increment: 5 },
  { id: 'hack_squat', name: 'Sentadilla Hack', primary: 'quads', secondary: ['glutes'], equipment: 'machine', shoulderFriendly: true, increment: 5 },
  { id: 'incline_leg_press', name: 'Prensa inclinada', primary: 'quads', secondary: ['glutes'], equipment: 'machine', shoulderFriendly: true, increment: 10 },
  { id: 'smith_squat', name: 'Sentadilla en Multipower', primary: 'quads', secondary: ['glutes'], equipment: 'smith', shoulderFriendly: false, increment: 2.5 },
  { id: 'hip_abduction', name: 'Máquina de abductores', primary: 'glutes', equipment: 'machine', shoulderFriendly: true, increment: 5 },
  { id: 'leg_extension', name: 'Extensión de cuádriceps', primary: 'quads', equipment: 'machine', shoulderFriendly: true, increment: 5 },
  { id: 'leg_curl', name: 'Curl femoral', primary: 'hamstrings', equipment: 'machine', shoulderFriendly: true, increment: 5 },
  { id: 'calf_raise', name: 'Gemelo en máquina', primary: 'calves', equipment: 'machine', shoulderFriendly: true, increment: 5 },
  { id: 'smith_incline_press', name: 'Press inclinado en Multipower', primary: 'chest', secondary: ['shoulders', 'arms'], equipment: 'smith', shoulderFriendly: false, increment: 2.5 },
  { id: 'db_neutral_press', name: 'Press neutro con mancuernas', primary: 'chest', secondary: ['arms'], equipment: 'dumbbell', shoulderFriendly: true, increment: 2 },
  { id: 'lat_pulldown', name: 'Jalón al pecho', primary: 'back', secondary: ['arms'], equipment: 'cable', shoulderFriendly: true, increment: 5 },
  { id: 'chest_supported_row', name: 'Remo con soporte en pecho', primary: 'back', secondary: ['rear_delts'], equipment: 'machine', shoulderFriendly: true, increment: 5 },
  { id: 'cable_lateral_raise', name: 'Elevaciones laterales en polea', primary: 'shoulders', equipment: 'cable', shoulderFriendly: true, increment: 1.25 },
  { id: 'face_pull', name: 'Facepull / rotación externa', primary: 'rear_delts', equipment: 'cable', shoulderFriendly: true, increment: 2.5 },
  { id: 'machine_chest_press', name: 'Press de pecho en máquina (agarre neutro)', primary: 'chest', equipment: 'machine', shoulderFriendly: true, increment: 5 },
  { id: 'pec_deck', name: 'Contractora (pec deck)', primary: 'chest', equipment: 'machine', shoulderFriendly: true, increment: 5 },
  { id: 'belt_squat', name: 'Belt squat', primary: 'quads', secondary: ['glutes'], equipment: 'machine', shoulderFriendly: true, increment: 5 },
  { id: 'single_arm_cable_row', name: 'Remo unilateral en polea', primary: 'back', equipment: 'cable', shoulderFriendly: true, increment: 2.5 },
  { id: 'cable_curl', name: 'Curl de bíceps en polea', primary: 'arms', equipment: 'cable', shoulderFriendly: true, increment: 2.5 },
  { id: 'triceps_pushdown', name: 'Extensión de tríceps en polea', primary: 'arms', equipment: 'cable', shoulderFriendly: true, increment: 2.5 },
];

export const EXERCISE_MAP: ReadonlyMap<string, Exercise> = new Map(EXERCISES.map((e) => [e.id, e]));

/**
 * Sustitutos que reducen la carga en el hombro. Criterio: agarre neutro, trayectoria guiada,
 * sin barra apoyada en trapecios ni presses con rotación interna.
 */
export const SHOULDER_SAFE_SWAPS: Record<string, string[]> = {
  smith_incline_press: ['db_neutral_press', 'machine_chest_press'],
  smith_squat: ['belt_squat', 'v_squat', 'hack_squat'],
  db_neutral_press: ['machine_chest_press', 'pec_deck'],
  lat_pulldown: ['single_arm_cable_row', 'chest_supported_row'],
  cable_lateral_raise: ['face_pull'],
};

export const TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'tpl_legs',
    name: 'Pierna · Énfasis cuádriceps',
    focus: 'legs',
    exercises: [
      { exerciseId: 'v_squat', sets: 3, repMin: 6, repMax: 10, restSec: 180 },
      { exerciseId: 'hack_squat', sets: 3, repMin: 8, repMax: 12, restSec: 150, note: 'Alterna con prensa inclinada' },
      { exerciseId: 'smith_squat', sets: 2, repMin: 8, repMax: 12, restSec: 150 },
      { exerciseId: 'hip_abduction', sets: 3, repMin: 12, repMax: 15, restSec: 90 },
      { exerciseId: 'leg_extension', sets: 3, repMin: 10, repMax: 15, restSec: 90 },
      { exerciseId: 'leg_curl', sets: 3, repMin: 10, repMax: 12, restSec: 90 },
      { exerciseId: 'calf_raise', sets: 3, repMin: 10, repMax: 15, restSec: 90 },
    ],
  },
  {
    id: 'tpl_upper',
    name: 'Torso · Hombro seguro',
    focus: 'upper',
    exercises: [
      { exerciseId: 'smith_incline_press', sets: 3, repMin: 6, repMax: 10, restSec: 150, note: 'Bajada controlada 3 s, codos a ~45°' },
      { exerciseId: 'db_neutral_press', sets: 3, repMin: 8, repMax: 12, restSec: 120 },
      { exerciseId: 'lat_pulldown', sets: 3, repMin: 8, repMax: 12, restSec: 120 },
      { exerciseId: 'chest_supported_row', sets: 3, repMin: 8, repMax: 12, restSec: 120 },
      { exerciseId: 'cable_lateral_raise', sets: 3, repMin: 12, repMax: 20, restSec: 90 },
      { exerciseId: 'face_pull', sets: 3, repMin: 12, repMax: 20, restSec: 90 },
    ],
  },
];

export function exerciseName(id: string): string {
  return EXERCISE_MAP.get(id)?.name ?? id;
}
