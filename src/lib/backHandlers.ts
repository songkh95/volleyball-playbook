type BackHandler = () => boolean;

const handlers: BackHandler[] = [];

/** 나중에 등록한 핸들러가 먼저 실행됩니다. true면 뒤로 가기를 소비합니다. */
export function registerBackHandler(handler: BackHandler): () => void {
  handlers.push(handler);
  return () => {
    const i = handlers.lastIndexOf(handler);
    if (i >= 0) handlers.splice(i, 1);
  };
}

export function handleBack(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]()) return true;
  }
  return false;
}
