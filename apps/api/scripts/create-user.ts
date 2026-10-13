/**
 * Operator CLI to provision an account with any role — the ONLY way to create FACULTY, ADMIN or
 * SUPER_ADMIN users until the admin portal exists (CLIENT-CLARIFICATIONS S-05).
 *
 *   npm run auth:create-user -- --email jane@example.com --name "Jane Doe" --role ADMIN
 *
 * The password is never passed as an argument (it would land in shell history and `ps`):
 *   - from the NEW_USER_PASSWORD environment variable, or
 *   - typed at a hidden interactive prompt.
 * The account is created ACTIVE with its email marked verified (the operator vouches for it).
 */
import { parseArgs } from 'node:util';
import { USER_ROLES } from '@asra/types';
import { ZodError, z } from 'zod';
import { disconnectPrisma } from '../src/database/prisma.js';
import { provisionUser } from '../src/services/user-provisioning.service.js';
import { AppError } from '../src/utils/app-error.js';

function readHiddenLine(prompt: string): Promise<string> {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) {
    return Promise.reject(new Error('Set NEW_USER_PASSWORD when not running interactively.'));
  }
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          cleanup();
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          cleanup();
          reject(new Error('Cancelled'));
          return;
        }
        value = char === '\u007f' ? value.slice(0, -1) : value + char;
      }
    };
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      role: { type: 'string' },
    },
  });
  const role = z.enum(USER_ROLES).safeParse(values.role);
  if (!values.email || !values.name || !role.success) {
    console.error(
      `Usage: npm run auth:create-user -- --email <email> --name "<full name>" --role <${USER_ROLES.join('|')}>`,
    );
    process.exitCode = 1;
    return;
  }

  let password = process.env.NEW_USER_PASSWORD;
  if (!password) {
    password = await readHiddenLine('Password: ');
    if ((await readHiddenLine('Confirm password: ')) !== password) {
      throw new Error('Passwords do not match');
    }
  }

  const user = await provisionUser({
    email: values.email,
    fullName: values.name,
    password,
    role: role.data,
  });
  console.log(`✔ Created ${role.data} ${user.email} (id ${user.id})`);
}

main()
  .catch((error: unknown) => {
    if (error instanceof ZodError) {
      console.error(
        '✘ ' +
          error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n  '),
      );
    } else {
      console.error(
        `✘ ${error instanceof AppError || error instanceof Error ? error.message : String(error)}`,
      );
    }
    process.exitCode = 1;
  })
  .finally(disconnectPrisma);
