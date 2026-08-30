const COMMUNITY_URL='https://snazzy-puppy-be2958.netlify.app/';

function openForgotPassword(){
  const loginEmail=document.getElementById('loginEmail')?.value?.trim()||'';
  document.getElementById('resetEmail').value=loginEmail;
  document.getElementById('resetMessage').textContent='';
  document.getElementById('forgotPasswordModal').classList.add('open');
}

function closeForgotPassword(){
  document.getElementById('forgotPasswordModal').classList.remove('open');
}

async function sendPasswordReset(){
  const email=document.getElementById('resetEmail').value.trim();
  const message=document.getElementById('resetMessage');
  const button=document.getElementById('sendResetButton');
  message.classList.remove('error');
  if(!email){message.textContent='Please enter your email address.';message.classList.add('error');return;}
  button.disabled=true;button.textContent='Sending...';
  const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:COMMUNITY_URL});
  button.disabled=false;button.textContent='Send Reset Link';
  if(error){message.textContent=error.message;message.classList.add('error');return;}
  message.textContent='If an account exists for this email, a password reset link has been sent. Please check your inbox and spam folder.';
}

function openNewPasswordModal(){
  closeForgotPassword();
  document.getElementById('newPassword').value='';
  document.getElementById('confirmNewPassword').value='';
  document.getElementById('newPasswordMessage').textContent='';
  document.getElementById('newPasswordModal').classList.add('open');
}

async function updateRecoveredPassword(){
  const password=document.getElementById('newPassword').value;
  const confirmPassword=document.getElementById('confirmNewPassword').value;
  const message=document.getElementById('newPasswordMessage');
  const button=document.getElementById('updatePasswordButton');
  message.classList.remove('error');
  if(password.length<8){message.textContent='Use at least 8 characters.';message.classList.add('error');return;}
  if(password!==confirmPassword){message.textContent='The passwords do not match.';message.classList.add('error');return;}
  button.disabled=true;button.textContent='Updating...';
  const {error}=await supabaseClient.auth.updateUser({password});
  button.disabled=false;button.textContent='Update Password';
  if(error){message.textContent=error.message;message.classList.add('error');return;}
  document.getElementById('newPasswordModal').classList.remove('open');
  showToast('✓ Password updated successfully');
  const url=new URL(window.location.href);
  url.hash='';
  history.replaceState({},'',url.pathname+url.search);
}

supabaseClient.auth.onAuthStateChange((event)=>{
  if(event==='PASSWORD_RECOVERY') setTimeout(openNewPasswordModal,50);
});

// Recovery links can arrive with hash/query parameters before the auth event listener settles.
window.addEventListener('load',()=>{
  const hash=window.location.hash;
  if(hash.includes('type=recovery')) setTimeout(openNewPasswordModal,250);
});