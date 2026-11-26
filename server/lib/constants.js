// Las claves se guardan en la BD; el frontend las traduce.
export const SPECIALTIES = [
  'service_dog',
  'psychiatric_service',
  'emotional_support',
  'medical_alert',
  'diabetic_alert',
  'seizure_alert',
  'mobility',
  'hearing',
  'guide',
  'autism_support',
  'ptsd_support',
  'therapy',
];

// Para el carnet impreso (bilingüe ES / EN).
export const SPECIALTY_LABELS = {
  service_dog: ['Perro de servicio', 'Service dog'],
  psychiatric_service: ['Servicio psiquiátrico', 'Psychiatric service'],
  emotional_support: ['Apoyo emocional', 'Emotional support'],
  medical_alert: ['Alerta médica', 'Medical alert'],
  diabetic_alert: ['Alerta de diabetes', 'Diabetic alert'],
  seizure_alert: ['Alerta de convulsiones', 'Seizure alert'],
  mobility: ['Asistencia de movilidad', 'Mobility assistance'],
  hearing: ['Discapacidad auditiva', 'Hearing dog'],
  guide: ['Perro guía', 'Guide dog'],
  autism_support: ['Apoyo en autismo', 'Autism support'],
  ptsd_support: ['Apoyo TEPT', 'PTSD support'],
  therapy: ['Terapia', 'Therapy'],
};

export const ROLES = ['admin', 'editor', 'viewer'];
