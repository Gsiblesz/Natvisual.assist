export type EstadoCliente = "activo" | "inactivo" | "archivado";

export type Cuenta = { id: number; nombre_cliente: string; estado: EstadoCliente };

export type Paso = {
  id: number;
  tarea_id: number;
  orden: number;
  nombre: string;
  fecha: string | null;
  hecho_en: string | null;
};

export type Tarea = {
  id: number;
  cuenta_id: number;
  nombre_cliente: string;
  estado_cliente: EstadoCliente;
  titulo: string;
  descripcion: string;
  tipo: string;
  estado: "pendiente" | "en_progreso" | "hecho";
  urgente: boolean;
  fecha_entrega: string | null;
  creado_en: string;
  pasos: Paso[];
};
