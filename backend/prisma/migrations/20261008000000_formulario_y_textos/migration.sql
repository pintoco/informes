-- AlterTable
ALTER TABLE "Service" ALTER COLUMN "nombreTecnico" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contactEmail" TEXT;

-- CreateTable
CREATE TABLE "TextTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TextTemplate_pkey" PRIMARY KEY ("id")
);

-- Textos predefinidos iniciales (frases más repetidas en los servicios existentes)
INSERT INTO "TextTemplate" ("id", "title", "body", "orden", "updatedAt") VALUES
  (gen_random_uuid()::text, $tpl$Diagnóstico de falla (3 testeos)$tpl$, $tpl$Se realiza labor de diagnóstico técnico en la cámara CCTV mencionada, efectuando las pruebas correspondientes para determinar el origen de la falla. Para ello, se realizan tres tipos de testeos: red, fibra óptica y alimentación eléctrica, utilizando los elementos, herramientas y tester necesarios para cada medición.

* Testeo de red: Se realiza revisión y comprobación del enlace de red desde el punto de conexión hasta el equipo correspondiente, verificando continuidad, conectividad y comunicación de datos. Se efectúan las pruebas necesarias mediante tester de red para descartar fallas en el cableado, conectores y equipos de comunicación. (Resultado: corresponde a la falla: [Sí/No])

* Testeo de fibra óptica: Se realiza revisión del enlace de fibra óptica asociado a la cámara, efectuando las mediciones y comprobaciones correspondientes para verificar la correcta transmisión de señal, descartando posibles cortes, pérdidas o inconvenientes en los conectores, conversores y tendido de fibra. (Resultado: corresponde a la falla: [Sí/No])

* Testeo eléctrico: Se realiza medición de la alimentación eléctrica asociada al sistema, verificando presencia, continuidad y valores de tensión en los puntos correspondientes, con el objetivo de descartar inconvenientes relacionados con la fuente de alimentación, transformador, UPS u otros componentes eléctricos. (Resultado: corresponde a la falla: [Sí/No])

Conclusión del diagnóstico: De acuerdo con las pruebas realizadas, se determina que la falla presentada por la cámara corresponde a la causa identificada durante los testeos. (Origen de la falla: [completar])

La presente intervención corresponde exclusivamente a un proceso de diagnóstico y determinación de la causa de la falla, quedando pendiente la ejecución del mantenimiento correctivo correspondiente, según el resultado obtenido y los componentes que deban ser reparados o reemplazados.$tpl$, 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, $tpl$Mantenimiento preventivo$tpl$, $tpl$Se da inicio a las labores de mantenimiento preventivo en la cámara ya mencionada en el presente informe, realizando limpieza general del equipo y revisión de sus componentes, tal como se evidencia en las imágenes adjuntas.

Los trabajos contemplan inspección visual, limpieza de carcasa, cúpula y conexiones, además de la verificación del estado general del equipamiento, con la finalidad de mantener un óptimo funcionamiento del sistema de televigilancia, prevenir futuras fallas y prolongar la vida útil y durabilidad del equipo.

La intervención se realiza sin inconvenientes, quedando el equipo en óptimas condiciones de operación.$tpl$, 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, $tpl$Correctivo de enlace (coordinación DISEP)$tpl$, $tpl$Tras la confirmación y coordinación con DISEP, se procede a realizar labores de mantenimiento correctivo en el punto CCTV afectado, con la finalidad de revisar y optimizar la configuración del enlace de comunicaciones asociado a la cámara.

Durante la intervención se efectúan ajustes y mejoras en la configuración del enlace, realizando las pruebas técnicas correspondientes para verificar la estabilidad y rendimiento de la conexión.

Posteriormente, se confirma que las mejoras implementadas presentan un funcionamiento óptimo, restableciendo la correcta operatividad del sistema. Con ello, se da por finalizado el proceso de mantenimiento correctivo de la cámara mencionada.$tpl$, 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, $tpl$Correctivo de fibra óptica (fusión y conversor)$tpl$, $tpl$Se dirige nuevamente al punto ([completar]), con el objetivo de realizar la intervención correctiva correspondiente a la falla detectada previamente en el enlace de fibra óptica.

Durante la intervención se procede a realizar la fusión de una nueva punta de fibra óptica y el cambio del conversor, efectuando posteriormente las pruebas correspondientes para verificar la recuperación del enlace.

Materiales y trabajos realizados:

* Se reemplaza un conversor de fibra Gigabit.
* Se fusiona una nueva punta de fibra óptica.
* Se cambia 1 conector de fibra LC.
* Se testea nuevamente la fibra mediante un medidor de potencia.
* Se confirma la correcta visualización de la cámara mediante comunicación con Central.

Finalizados los trabajos, se comprueba la correcta conectividad y comunicación del punto, quedando habilitado y operativo, con correcta visualización y transmisión de video.$tpl$, 4, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, $tpl$Punto sin suministro eléctrico$tpl$, $tpl$Se procede a revisar la cámara ubicada en [completar], tras solicitud registrada en la planilla de control (Excel) y reportada por sala espejo, donde se indica que el equipo presenta inconvenientes.

Se acude a terreno con el objetivo de realizar la inspección correspondiente, identificar la causa de la falla y ejecutar las acciones necesarias para restablecer su correcta operatividad.

Específicamente, se constata que el punto no cuenta con suministro eléctrico, debido a una interrupción en la alimentación del sistema.

Durante la intervención, personal de Empresa Elemental ejecuta las labores necesarias para reparar y restablecer la conexión eléctrica del punto, permitiendo recuperar la alimentación de los equipos asociados al sistema de televigilancia.

Una vez normalizado el suministro eléctrico, se realizan las pruebas de funcionamiento correspondientes, verificando que la cámara recupera su operatividad y queda visualizando correctamente en la plataforma de monitoreo.$tpl$, 5, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, $tpl$Cierre de correctivo$tpl$, $tpl$Finalizados los trabajos, se comprueba la correcta conectividad y comunicación del punto, quedando habilitado y operativo, con correcta visualización y transmisión de video. Con ello, se da por finalizado el proceso de mantenimiento correctivo de la cámara mencionada.$tpl$, 6, CURRENT_TIMESTAMP);
