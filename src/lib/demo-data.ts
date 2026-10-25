export type DocStatus =
  | "Menunggu Review"
  | "Menunggu"
  | "Disetujui"
  | "Terkirim SIMRS"
  | "Draft"
  | "Diperiksa"
  | "Terjadwal";

export interface Consultation {
  id: string;
  initials: string;
  patient: string;
  recordNo: string;
  time: string;
  diagnosis: string;
  status: DocStatus;
}

export interface Patient {
  id: string;
  initials: string;
  name: string;
  recordNo: string;
  age: number;
  gender: "Laki-laki" | "Perempuan";
  birthDate: string;
  bloodType: string;
  schedule: string;
  status: DocStatus;
  clinic: string;
  lastHistory: string;
  lastHistoryDate: string;
  lastHistoryDoctor: string;
}

export const consultations: Consultation[] = [
  {
    id: "1",
    initials: "BS",
    patient: "Budi Santoso",
    recordNo: "RM-2024-00831",
    time: "Hari ini, 09:42",
    diagnosis: "Hipertensi Esensial",
    status: "Menunggu Review",
  },
  {
    id: "2",
    initials: "SA",
    patient: "Siti Aminah",
    recordNo: "RM-2023-01422",
    time: "Hari ini, 08:55",
    diagnosis: "Diabetes Melitus Tipe 2",
    status: "Disetujui",
  },
  {
    id: "3",
    initials: "AF",
    patient: "Ahmad Fauzi",
    recordNo: "RM-2022-00691",
    time: "Kemarin, 16:20",
    diagnosis: "Gastritis Akut",
    status: "Terkirim SIMRS",
  },
  {
    id: "4",
    initials: "DL",
    patient: "Dewi Lestari",
    recordNo: "RM-2024-00217",
    time: "Kemarin, 14:10",
    diagnosis: "ISPA",
    status: "Draft",
  },
  {
    id: "5",
    initials: "RH",
    patient: "Rudi Hartono",
    recordNo: "RM-2021-01903",
    time: "12 Jun 2025, 11:30",
    diagnosis: "Dislipidemia",
    status: "Terkirim SIMRS",
  },
];

export const patients: Patient[] = [
  {
    id: "1",
    initials: "BS",
    name: "Budi Santoso",
    recordNo: "RM-2024-00831",
    age: 54,
    gender: "Laki-laki",
    birthDate: "12 Agustus 1970",
    bloodType: "O+",
    schedule: "09:30 WIB",
    status: "Menunggu",
    clinic: "Poli Penyakit Dalam",
    lastHistory: "Hipertensi Esensial",
    lastHistoryDate: "28 Mei 2025",
    lastHistoryDoctor: "dr. Arief Wijaya",
  },
  {
    id: "2",
    initials: "SA",
    name: "Siti Aminah",
    recordNo: "RM-2023-01422",
    age: 42,
    gender: "Perempuan",
    birthDate: "3 Maret 1983",
    bloodType: "A+",
    schedule: "10:00 WIB",
    status: "Menunggu",
    clinic: "Poli Penyakit Dalam",
    lastHistory: "Diabetes Melitus Tipe 2",
    lastHistoryDate: "15 Mei 2025",
    lastHistoryDoctor: "dr. Arief Wijaya",
  },
  {
    id: "3",
    initials: "AF",
    name: "Ahmad Fauzi",
    recordNo: "RM-2022-00691",
    age: 61,
    gender: "Laki-laki",
    birthDate: "21 Januari 1964",
    bloodType: "B+",
    schedule: "10:30 WIB",
    status: "Diperiksa",
    clinic: "Poli Penyakit Dalam",
    lastHistory: "Gastritis Akut",
    lastHistoryDate: "2 Jun 2025",
    lastHistoryDoctor: "dr. Arief Wijaya",
  },
  {
    id: "4",
    initials: "DL",
    name: "Dewi Lestari",
    recordNo: "RM-2024-00217",
    age: 37,
    gender: "Perempuan",
    birthDate: "9 November 1987",
    bloodType: "AB+",
    schedule: "11:00 WIB",
    status: "Terjadwal",
    clinic: "Poli Penyakit Dalam",
    lastHistory: "ISPA",
    lastHistoryDate: "20 Mei 2025",
    lastHistoryDoctor: "dr. Arief Wijaya",
  },
  {
    id: "5",
    initials: "RH",
    name: "Rudi Hartono",
    recordNo: "RM-2021-01903",
    age: 48,
    gender: "Laki-laki",
    birthDate: "17 April 1977",
    bloodType: "O+",
    schedule: "11:30 WIB",
    status: "Terjadwal",
    clinic: "Poli Penyakit Dalam",
    lastHistory: "Dislipidemia",
    lastHistoryDate: "11 Apr 2025",
    lastHistoryDoctor: "dr. Arief Wijaya",
  },
  {
    id: "6",
    initials: "N",
    name: "Nurhayati",
    recordNo: "RM-2023-01108",
    age: 56,
    gender: "Perempuan",
    birthDate: "30 Juni 1969",
    bloodType: "A-",
    schedule: "13:00 WIB",
    status: "Terjadwal",
    clinic: "Poli Penyakit Dalam",
    lastHistory: "Nefropati Diabetik",
    lastHistoryDate: "6 Jun 2025",
    lastHistoryDoctor: "dr. Arief Wijaya",
  },
];

export const weeklyProductivity = [
  { day: "Sen", value: 42 },
  { day: "Sel", value: 55 },
  { day: "Rab", value: 38 },
  { day: "Kam", value: 78 },
  { day: "Jum", value: 60 },
  { day: "Sab", value: 30 },
  { day: "Min", value: 14 },
];

export const reviewQueue = [
  { id: "1", initials: "BS", name: "Budi Santoso", detail: "12 menit lalu" },
  { id: "2", initials: "DL", name: "Dewi Lestari", detail: "30 menit lalu" },
  { id: "3", initials: "AF", name: "Ahmad Fauzi", detail: "1 jam lalu" },
];

export const recentNotes = [
  {
    id: "1",
    initials: "BS",
    patient: "Budi Santoso",
    recordNo: "RM-2024-00831",
    diagnosis: "Hipertensi Esensial",
    status: "Menunggu Review" as DocStatus,
    created: "Hari ini, 09:42",
    duration: "12 mnt",
  },
  {
    id: "2",
    initials: "SA",
    patient: "Siti Aminah",
    recordNo: "RM-2023-01422",
    diagnosis: "Diabetes Melitus Tipe 2",
    status: "Menunggu Review" as DocStatus,
    created: "Hari ini, 10:05",
    duration: "8 mnt",
  },
  {
    id: "3",
    initials: "DL",
    patient: "Dewi Lestari",
    recordNo: "RM-2024-00217",
    diagnosis: "ISPA",
    status: "Menunggu Review" as DocStatus,
    created: "Hari ini, 11:12",
    duration: "6 mnt",
  },
  {
    id: "4",
    initials: "RH",
    patient: "Rudi Hartono",
    recordNo: "RM-2021-01903",
    diagnosis: "Dislipidemia",
    status: "Terkirim SIMRS" as DocStatus,
    created: "Kemarin, 13:40",
    duration: "10 mnt",
  },
  {
    id: "5",
    initials: "AF",
    patient: "Ahmad Fauzi",
    recordNo: "RM-2022-00691",
    diagnosis: "Gastritis Akut",
    status: "Disetujui" as DocStatus,
    created: "Kemarin, 15:20",
    duration: "9 mnt",
  },
];
