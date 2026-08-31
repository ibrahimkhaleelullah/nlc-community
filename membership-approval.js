// Membership approval workflow: Pending -> Active -> Declined.
// Loaded after app.js and rbac.js so it can extend the existing UI safely.

(function injectMembershipApprovalUI(){
 const main=document.querySelector('main.container');
 const memberShell=$('memberShell');
 if(main&&memberShell&&!$('pendingShell')){
  const pending=document.createElement('section');
  pending.id='pendingShell';pending.className='suspended-card';pending.style.display='none';
  pending.innerHTML='<div class="guest-kicker">Membership under review</div><h2>Your registration has been received.</h2><p>Your membership is currently pending review by the NLC team. You will be able to enter the community once your membership is approved.</p><p class="muted">You may leave this page and sign in again later to check your status.</p><button class="secondary" onclick="signOut()">Sign Out</button>';
  main.insertBefore(pending,memberShell);
 }
 if(main&&memberShell&&!$('declinedShell')){
  const declined=document.createElement('section');
  declined.id='declinedShell';declined.className='suspended-card';declined.style.display='none';
  declined.innerHTML='<div class="guest-kicker">Membership review complete</div><h2>Your community membership was not approved at this time.</h2><p>Please contact the NLC Community administrator if you would like clarification or believe this was a mistake.</p><button class="secondary" onclick="signOut()">Sign Out</button>';
  main.insertBefore(declined,memberShell);
 }
 const tabs=document.querySelector('.admin-tabs');
 const reportsTab=$('reportsTab');
 if(tabs&&reportsTab&&!$('approvalsTab')){
  const b=document.createElement('button');
  b.className='auth-tab';b.id='approvalsTab';b.type='button';b.textContent='Pending Approvals';b.onclick=()=>showAdminTab('approvals');
  tabs.insertBefore(b,reportsTab);
 }
 const reports=$('adminReports');
 if(reports&&!$('adminApprovals')){
  const box=document.createElement('div');box.id='adminApprovals';box.style.display='none';reports.parentNode.insertBefore(box,reports);
 }
})();

const membershipIsActive=()=>currentProfile?.membership_status==='active';
const membershipIsPending=()=>currentProfile?.membership_status==='pending';
const membershipIsDeclined=()=>currentProfile?.membership_status==='declined';

// New signups are created as pending in the database trigger.
signUp=async function(){
 const name=$('signupName').value.trim(),email=$('signupEmail').value.trim(),password=$('signupPassword').value,button=$('signupButton');
 if(!name)return setAuthMessage('Please enter your full name.',true);
 if(!email)return setAuthMessage('Please enter your email address.',true);
 if(password.length<6)return setAuthMessage('Your password must be at least 6 characters.',true);
 button.disabled=true;button.textContent='Creating Account...';
 const{data,error}=await supabaseClient.auth.signUp({email,password,options:{data:{full_name:name}}});
 button.disabled=false;button.textContent='Create Account';
 if(error)return setAuthMessage(error.message,true);
 setAuthMessage(data.user&&!data.session
  ?'Account created. Please confirm your email. After confirmation, your membership will be reviewed by the NLC team before community access is enabled.'
  :'Account created successfully. Your membership is pending review by the NLC team.');
};

loadCurrentProfile=async function(user){
 currentProfile=null;if(!user)return;
 const{data,error}=await supabaseClient.from('profiles').select('id, full_name, bio, created_at, role, is_suspended, membership_status').eq('id',user.id).maybeSingle();
 if(!error)currentProfile=data||null;
};

// Preserve the existing shell behavior while adding Pending and Declined states.
updateAuthUI=function(user){
 const suspended=!!(user&&currentProfile?.is_suspended);
 const pending=!!(user&&!suspended&&membershipIsPending());
 const declined=!!(user&&!suspended&&membershipIsDeclined());
 const active=!!(user&&!suspended&&membershipIsActive());
 $('guestShell').style.display=user?'none':'grid';
 $('suspendedShell').style.display=suspended?'block':'none';
 if($('pendingShell'))$('pendingShell').style.display=pending?'block':'none';
 if($('declinedShell'))$('declinedShell').style.display=declined?'block':'none';
 $('memberShell').style.display=active?'block':'none';
 $('memberHeaderActions').style.display=user?'flex':'none';
 if(user){
  const name=getUserName(user);
  $('accountName').textContent=name;
  $('accountAvatar').textContent=getInitials(name);
  $('composerAvatar').textContent=getInitials(name);
  $('memberWelcomeTitle').textContent=`Welcome back, ${name.split(' ')[0]}`;
  $('adminMenuItem').style.display=isTeam()?'block':'none';
 }else{
  $('posts').innerHTML='';
  $('accountMenu').classList.remove('open');
 }
};

// Do not even attempt community reads while approval is pending/declined.
const originalLoadPosts=loadPosts;
loadPosts=async function(){
 if(!membershipIsActive()){
  if($('posts'))$('posts').innerHTML='';
  return;
 }
 return originalLoadPosts();
};

// Extend Admin Console with a dedicated approval queue.
showAdminTab=async function(tab){
 const allowed=['approvals','reports','members','team','audit','guide'];
 if(!allowed.includes(tab))tab='reports';
 if(currentProfile?.role==='moderator'&&['approvals','members','team','audit'].includes(tab))tab='reports';
 if(!isOwner()&&tab==='team')tab='members';
 if(tab==='approvals'&&!isAdmin())tab='reports';
 ['approvals','reports','members','team','audit','guide'].forEach(t=>{
  const b=$(t+'Tab'),p=$('admin'+t[0].toUpperCase()+t.slice(1));
  if(b)b.classList.toggle('active',t===tab);
  if(p)p.style.display=t===tab?'block':'none';
 });
 if(tab==='approvals')await loadPendingApprovals();
 if(tab==='reports')await loadAdminReports();
 if(tab==='members')await loadAdminMembers();
 if(tab==='team')await loadTeamRoles();
 if(tab==='audit')await loadAuditLog();
};

async function loadPendingApprovals(){
 const box=$('adminApprovals');
 if(!box)return;
 if(!isAdmin()){
  box.innerHTML='<div class="empty-state flat">Member approvals are available to administrators.</div>';
  return;
 }
 box.innerHTML='<div class="muted">Loading pending membership requests...</div>';
 const{data,error}=await supabaseClient.from('profiles')
  .select('id,full_name,created_at,membership_status,is_suspended')
  .eq('membership_status','pending')
  .order('created_at',{ascending:true});
 if(error){box.innerHTML='<div class="empty-state flat">Unable to load pending approvals.</div>';return;}
 if(!data?.length){box.innerHTML='<div class="empty-state flat">No memberships are waiting for approval.</div>';return;}
 box.innerHTML='<div class="team-note">Review new registrations before granting access to the private community.</div>'+data.map(p=>`
  <div class="member-row">
   <div><strong>${escapeHtml(p.full_name||'Community Member')}</strong><span class="role-badge">Pending</span><small>Registered ${formatDate(p.created_at)}</small></div>
   <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="primary" onclick="reviewMembership('${p.id}',true)">Approve</button><button class="secondary" onclick="reviewMembership('${p.id}',false)">Decline</button></div>
  </div>`).join('');
}

async function reviewMembership(memberId,approve){
 if(!isAdmin())return;
 let reason='';
 if(approve){
  if(!confirm('Approve this membership and grant community access?'))return;
 }else{
  if(!confirm('Decline this membership request?'))return;
  reason=prompt('Internal reason for declining (optional):')||'';
 }
 const{error}=await supabaseClient.rpc('set_member_approval',{target_id:memberId,approve,reason});
 if(error)return alert(error.message);
 showToast(approve?'Membership approved':'Membership declined');
 await loadPendingApprovals();
 await loadAdminStats();
}

// Pending members can leave the page open; refresh their status periodically.
let membershipStatusTimer=setInterval(async()=>{
 if(!currentUser||(!membershipIsPending()&&!membershipIsDeclined()))return;
 const before=currentProfile?.membership_status;
 await loadCurrentProfile(currentUser);
 if(currentProfile?.membership_status!==before){
  updateAuthUI(currentUser);
  if(membershipIsActive()){
   showToast('Your membership has been approved. Welcome!');
   await loadPosts();
   await loadNotificationBadge();
  }
 }
},15000);
