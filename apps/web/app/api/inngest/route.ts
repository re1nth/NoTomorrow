import { serve } from 'inngest/next';
import { inngest, functions } from '@/lib/inngest';

/**
 * Inngest serve handler. Mounting the module from `@/lib/inngest` ensures
 * `setDbAdapter(...)` ran before the runtime hits any function body.
 */
const handler = serve({ client: inngest, functions: [...functions] });

export { handler as GET, handler as POST, handler as PUT };
