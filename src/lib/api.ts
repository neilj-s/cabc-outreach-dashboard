import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');

let signInPromise: Promise<any> | null = null;

function triggerSignIn(): Promise<any> {
  if (signInPromise) return signInPromise;

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';
  overlay.style.backdropFilter = 'blur(4px)';
  
  const container = document.createElement('div');
  container.style.backgroundColor = 'white';
  container.style.padding = '32px';
  container.style.borderRadius = '12px';
  container.style.textAlign = 'center';
  container.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
  
  const title = document.createElement('h2');
  title.innerText = 'Authentication Required';
  title.style.margin = '0 0 16px 0';
  title.style.fontFamily = 'system-ui, sans-serif';
  
  const btn = document.createElement('button');
  btn.innerText = 'Sign in with Google';
  btn.style.padding = '10px 20px';
  btn.style.fontSize = '14px';
  btn.style.fontWeight = '600';
  btn.style.backgroundColor = '#1e293b';
  btn.style.color = 'white';
  btn.style.border = 'none';
  btn.style.borderRadius = '6px';
  btn.style.cursor = 'pointer';
  
  container.appendChild(title);
  container.appendChild(btn);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  signInPromise = new Promise((resolve, reject) => {
    btn.onclick = async () => {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        document.body.removeChild(overlay);
        resolve(result);
      } catch (err) {
        document.body.removeChild(overlay);
        reject(err);
      } finally {
        signInPromise = null;
      }
    };
  });
  
  return signInPromise;
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  await auth.authStateReady();
  let user = auth.currentUser;
  
  if (!user) {
    try {
      const result = await triggerSignIn();
      user = result.user;
    } catch (err) {
      console.error('Login required for API call', err);
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const token = await user.getIdToken();
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, {
    ...options,
    headers
  });

  // Override res.json to gracefully handle HTML errors or non-JSON payloads
  const originalJson = res.json.bind(res);
  res.json = async () => {
    try {
      const contentType = res.headers.get('content-type');
      if (!res.ok && (!contentType || !contentType.toLowerCase().includes('application/json'))) {
        let errorMsg = `Server error: ${res.status}`;
        if (res.status === 403) {
          errorMsg = 'Access restricted to authorized ministry accounts';
        } else if (res.status === 401) {
          errorMsg = 'Authentication required';
        }
        return { error: errorMsg };
      }
      return await originalJson();
    } catch (err) {
      console.error('Error parsing response JSON in apiFetch:', err);
      let errorMsg = `Invalid response format (${res.status})`;
      if (res.status === 403) {
        errorMsg = 'Access restricted to authorized ministry accounts';
      } else if (res.status === 401) {
        errorMsg = 'Authentication required';
      }
      return { error: errorMsg };
    }
  };

  return res;
}
