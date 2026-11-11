export type Cuenta = { id: number; nombre_cliente: string };

export type Tarea = {
  id: number;
  cuenta_id: number;
  nombre_cliente: string;
  titulo: string;
  descripcion: string;
  estado: "pendiente" | "en_progreso" | "hecho";
  prioridad_cliente: number;
  urgencia_humana: number;
  prioridad_modo: "cliente" | "humana";
  fecha_entrega: string | null;
  etiqueta: string;
};

export type Aviso = {
  id: number;
  titulo: string;
  canal: string;
  estado: string;
  detalle: string;
  creado_en: string;
};

export type Calendario = {
  proveedor: "ics" | "google";
  correo_equipo: string;
  google_calendar_id: string;
  aviso_horas: number;
};

export type Historial = {
  id: number;
  estado_anterior: string | null;
  estado_nuevo: string;
  nota: string;
  creado_en: string;
};
