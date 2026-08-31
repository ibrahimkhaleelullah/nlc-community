const isTeam=()=>['moderator','admin','owner'].includes(currentProfile?.role);
const isOwner=()=>currentUser?.id==='c760028c-56da-4b38-b92e-7cb8e471d4ec';

async function openAdminPanel(){if(!isTeam())return;$('accountMenu').classList.remove('open');$('adminModal').classList.add('open');$('adminRoleLabel').textContent=isOwner()?'Owner access':`${(currentProfile?.role||'team').replace(/^./,c=>c.toUpperCase())} access`;await loadAdminStats();await showAdminTab('reports')}

async function showAdminTab(tab){
 const allowed=['reports','members','team','audit','guide'];
 if(!allowed.includes(tab))tab='reports';
 if(currentProfile?.role==='moderator'&&['members','team','audit'].includes(tab))tab='reports';
 if(!isOwner()&&tab==='team')tab='members';
 ['reports','members','team','audit','guide'].forEach(t=>{const b=$(t+'Tab'),p=$('admin'+t[0].toUpperCase()+t.slice(1));if(b)b.classList.toggle('active',t===tab);if(p)p.style.display=t===tab?'block':'none'});
 if(tab==='reports')await loadAdminReports();
 if(tab==='members')await loadAdminMembers();
 if(tab==='team')await loadTeamRoles();
 if(tab==='audit')await loadAuditLog();
}

async function loadTeamRoles(){
 const box=$('adminTeam');if(!isOwner()){box.innerHTML='<div class="empty-state flat">Only the community owner can assign team roles.</div>';return}
 box.innerHTML='<div class="muted">Loading team roles...</div>';
 const{data,error}=await supabaseClient.from('profiles').select('id,full_name,role,is_suspended,created_at').order('full_name');
 if(error){box.innerHTML='<div class="muted">Unable to load team roles.</div>';return}
 box.innerHTML='<div class="team-note">Assign the minimum access each person needs. Moderators handle content; Admins can also manage member access.</div>'+data.map(p=>{
  const owner=p.id===currentUser.id;
  return `<div class="member-row"><div><strong>${escapeHtml(p.full_name||'Community Member')}</strong><span class="role-badge">${owner?'Owner':escapeHtml(p.role||'member')}</span><small>${p.is_suspended?'Access suspended':'Active'} · Joined ${formatMemberSince(p.created_at)}</small></div><div>${owner?'<span class="muted">Protected owner</span>':`<select class="role-select" onchange="changeMemberRole('${p.id}',this.value)"><option value="member" ${p.role==='member'?'selected':''}>Member</option><option value="moderator" ${p.role==='moderator'?'selected':''}>Moderator</option><option value="admin" ${p.role==='admin'?'selected':''}>Admin</option></select>`}</div></div>`}).join('')
}

async function changeMemberRole(memberId,newRole){if(!isOwner())return;const label=newRole[0].toUpperCase()+newRole.slice(1);if(!confirm(`Change this person's role to ${label}?`)){await loadTeamRoles();return}const{error}=await supabaseClient.rpc('set_member_role',{target_id:memberId,new_role:newRole});if(error){alert(error.message);await loadTeamRoles();return}showToast(`Role changed to ${label}`);await loadTeamRoles();await loadAuditLog()}

async function loadAuditLog(){
 const box=$('adminAudit');if(!isAdmin()){box.innerHTML='<div class="empty-state flat">Audit history is available to administrators.</div>';return}
 box.innerHTML='<div class="muted">Loading audit history...</div>';
 const{data,error}=await supabaseClient.from('admin_audit_log').select('*').order('created_at',{ascending:false}).limit(100);
 if(error){box.innerHTML='<div class="muted">Unable to load audit history.</div>';return}
 if(!data?.length){box.innerHTML='<div class="empty-state flat">No administrative actions recorded yet.</div>';return}
 const ids=[...new Set(data.flatMap(x=>[x.actor_id,x.target_user_id]).filter(Boolean))];let profiles=[];if(ids.length){const r=await supabaseClient.from('profiles').select('id,full_name').in('id',ids);profiles=r.data||[]}
 const names=Object.fromEntries(profiles.map(p=>[p.id,p.full_name||'Member']));
 box.innerHTML=data.map(a=>`<div class="audit-row"><strong>${escapeHtml(names[a.actor_id]||'System')}</strong> ${escapeHtml(a.action.replaceAll('_',' '))}${a.target_user_id?` · ${escapeHtml(names[a.target_user_id]||'Member')}`:''}${a.details?`<div>${escapeHtml(a.details)}</div>`:''}<small>${formatDate(a.created_at)}</small></div>`).join('')
}

async function setMemberSuspension(memberId,suspend){if(!isAdmin()||memberId===currentUser.id)return;let reason='';if(suspend){if(!confirm('Suspend this member? They will lose community access.'))return;reason=prompt('Internal reason for suspension (recommended):')||''}const{error}=await supabaseClient.rpc('set_member_suspension',{target_id:memberId,suspend,reason});if(error)return alert(error.message);showToast(suspend?'Member suspended':'Member access restored');await loadAdminMembers();await loadAdminStats()}

async function togglePin(postId,isPinned){if(!isAdmin())return;const{error}=await supabaseClient.rpc('set_post_pin',{target_post_id:postId,pin:!isPinned});if(error)return alert(error.message);showToast(isPinned?'Post unpinned':'Post pinned');await loadPosts()}

async function resolveReport(id,status){const{error}=await supabaseClient.rpc('resolve_report',{target_report_id:id,new_status:status});if(error)return alert(error.message);await loadAdminStats();await loadAdminReports()}

// Keep the admin entry and role-specific tabs aligned with the signed-in profile.
setInterval(()=>{if(!currentUser)return;const menu=$('adminMenuItem');if(menu)menu.style.display=isTeam()?'block':'none';const team=$('teamTab'),audit=$('auditTab'),members=$('membersTab');if(team)team.style.display=isOwner()?'inline-block':'none';if(audit)audit.style.display=isAdmin()?'inline-block':'none';if(members)members.style.display=isAdmin()?'inline-block':'none'},500);

// Load the membership approval extension after the RBAC helpers are available.
(()=>{const s=document.createElement('script');s.src='membership-approval.js';s.defer=true;document.body.appendChild(s)})();
