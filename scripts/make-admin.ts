import { getUserByEmail, updateUser } from '../src/lib/db.js';

async function main() {
  const email = 'kenmuisyo@gmail.com';
  const user = await getUserByEmail(email);
  if (!user) {
    console.error(`User with email ${email} not found.`);
    process.exit(1);
  }

  await updateUser(user.id, { role: 'SYSTEM_ADMIN' });
  console.log(`Successfully updated ${email} to SYSTEM_ADMIN.`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
