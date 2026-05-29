import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Sembrando base de datos...");

  // 1. Crear centro de salud
  const centro = await prisma.centroSalud.upsert({
    where: { id: "centro-villa-el-sol" },
    update: {},
    create: {
      id: "centro-villa-el-sol",
      nombre: "Centro de Salud Villa El Sol",
      distrito: "Villa El Salvador",
      region: "Lima",
      tipo: "MINSA",
      maxProfesionales: 10,
    },
  });

  console.log("✅ Centro de salud:", centro.nombre);

  // 2. Crear usuario profesional
  const passwordHash = await bcrypt.hash("doctor123", 10);
  const userDoc = await prisma.user.upsert({
    where: { email: "doctor@saludencodigo.pe" },
    update: {},
    create: {
      email: "doctor@saludencodigo.pe",
      name: "Dr. Ricardo Morales",
      passwordHash,
      role: "PROFESIONAL",
      centroSaludId: centro.id,
    },
  });

  console.log("✅ Usuario profesional:", userDoc.email);

  // 3. Crear perfil profesional
  const profesional = await prisma.profesional.upsert({
    where: { userId: userDoc.id },
    update: {},
    create: {
      userId: userDoc.id,
      centroSaludId: centro.id,
      especialidad: "Medicina General",
      colegioMedico: "CMP-78452",
    },
  });

  console.log("✅ Profesional:", profesional.especialidad);

  // 4. Crear usuario admin
  const adminHash = await bcrypt.hash("admin123", 10);
  const userAdmin = await prisma.user.upsert({
    where: { email: "admin@saludencodigo.pe" },
    update: {},
    create: {
      email: "admin@saludencodigo.pe",
      name: "Administrador Sistema",
      passwordHash: adminHash,
      role: "ADMIN",
      centroSaludId: centro.id,
    },
  });

  console.log("✅ Usuario admin:", userAdmin.email);

  // 5. Crear pacientes de ejemplo
  const pacientes = [
    {
      nombre: "María López",
      dni: "45678901",
      edad: 45,
      sexo: "F",
      condiciones: ["diabetes_tipo2", "hipertension"],
    },
    {
      nombre: "Carmen Quispe",
      dni: "32145698",
      edad: 28,
      sexo: "F",
      condiciones: ["gestante"],
    },
    {
      nombre: "José Huamán",
      dni: "78965412",
      edad: 62,
      sexo: "M",
      condiciones: ["diabetes_tipo2", "enfermedad_renal"],
    },
  ];

  for (const p of pacientes) {
    const paciente = await prisma.paciente.upsert({
      where: {
        dni_centroSaludId: {
          dni: p.dni,
          centroSaludId: centro.id,
        },
      },
      update: {},
      create: {
        ...p,
        centroSaludId: centro.id,
      },
    });
    console.log("✅ Paciente:", paciente.nombre);
  }

  console.log("\n🎉 Seed completado!");
  console.log("───────────────────────────────");
  console.log("Login profesional:");
  console.log("  Email: doctor@saludencodigo.pe");
  console.log("  Password: doctor123");
  console.log("───────────────────────────────");
  console.log("Login admin:");
  console.log("  Email: admin@saludencodigo.pe");
  console.log("  Password: admin123");
  console.log("───────────────────────────────");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
