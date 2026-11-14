/**
 * threejs-components@0.0.19 removes its global listeners with fresh .bind()
 * identities, so dispose() alone retains the engine. Record the actual
 * subscriptions during its synchronous factory call. Restore both methods
 * before returning: nothing is intercepted during rendering or normal UI work.
 */
export function createEngineScope() {
  const subscriptions: Array<() => void> = [];
  const release = () => subscriptions.splice(0).forEach(remove => remove());

  const create = <T,>(factory: () => T): T => {
    const restore: Array<() => void> = [];
    try {
      for (const [target, eventType] of [[window, 'resize'], [document, 'visibilitychange']] as const) {
        const descriptor = Object.getOwnPropertyDescriptor(target, 'addEventListener');
        const add = target.addEventListener;
        const remove = target.removeEventListener;
        Object.defineProperty(target, 'addEventListener', {
          configurable: true,
          writable: true,
          value(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
            add.call(target, type, listener, options);
            if (type === eventType && listener) {
              const capture = typeof options === 'boolean' ? options : options?.capture;
              subscriptions.push(() => remove.call(target, type, listener, capture));
            }
          },
        });
        restore.push(() => {
          if (descriptor) Object.defineProperty(target, 'addEventListener', descriptor);
          else Reflect.deleteProperty(target, 'addEventListener');
        });
      }
      return factory();
    } catch (error) {
      release();
      throw error;
    } finally {
      restore.reverse().forEach(reset => reset());
    }
  };

  return { create, release };
}
