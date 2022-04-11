const store = {
  hotRepos: [],
  prolificUsers: []
}
const repoButton = document.querySelector('#hot_repo')
const userButton = document.querySelector('#prolific_users')
// controller for aborting possibly conflicting updateFollowerCounts fetches
let controller 

// Utility functions
function formatDateForQuery(date) {
    // date.toISOString() will return UTC so don't use that!
    return date.toLocaleString('sv').slice(0,10)
}
function buildFullQueryString(q,sort) {
  return [
    `q=${encodeURIComponent(q)}`,
    'per_page=5',
    'sort=' + sort,
    'order=desc'    
  ].join('&')
}
function parseHotRepoResult(res) {
  return res.items.map(
    ({id, name, description, stargazers_count}) => ({id, name, description, stargazers_count})
  )
}
function parseProlificUserResult(res) {
  return res.items.map(
    ({id, login, avatar_url}) => ({id, login, avatar_url})
  )
}

// Templates
function renderRepoRow(repoEntry, index) {
    return `
<div class="fakerow" data-row-index="${index}">
  <span class="id">${repoEntry.id}</span>
  <span class="name">${repoEntry.name}</span>
  <span class="description">${repoEntry.description ?? ''}</span>
  <span class="stars">${parseInt(repoEntry.stargazers_count).toLocaleString()}</span>
</div>
`
}
function renderUserRow(userEntry, index) {
    return `
<div class="fakerow" data-row-index="${index}">
  <span class="id">${userEntry.id}</span>
  <span class="avatar"><img src="${userEntry.avatar_url}" alt="avatar for ${userEntry.login}"></span>
  <span class="login">${userEntry.login}</span>
  <span class="followers">${userEntry.followers?.toLocaleString() ?? ''}</span>
</div>
`
}
function renderNoContent() {
  return `<div class="fakerow none"><span class="none">No content</span></div>`
}

// Template aggregators
function renderAllRepoRows(repoEntries) {
  if (repoEntries.length === 0) return renderNoContent()
  return repoEntries.map((entry, index) => renderRepoRow(entry, index)).join("\n")
}
function renderAllUserRows(userEntries) {
  if (userEntries.length === 0) return renderNoContent()
  return userEntries.map((entry, index) => renderUserRow(entry, index)).join("\n")
}

// Final DOM insertion and guards
function renderRepoTable() {
  if (!store.hotRepos || !Array.isArray(store.hotRepos)) return
  document.querySelector('#hot_repos_results').innerHTML = renderAllRepoRows(store.hotRepos)
}
function renderUserTable() {
  if (!store.prolificUsers || !Array.isArray(store.prolificUsers)) return
  document.querySelector('#prolific_users_results').innerHTML = renderAllUserRows(store.prolificUsers)
}

// Fetch and display
function updateFollowerCounts(userList) {
  controller = new AbortController()
  const signal = controller.signal
  userList.forEach( user => {
    fetch(
      'https://api.github.com/users/' + user.login,
      { signal }
    )
      .then(res => res.json())
      .then(data => {
        user.followers = data.followers
        renderUserTable()
        userButton.disabled = false
      })
      .catch(err => {console.error(err.message)})
  })
}
function updateHotRepos() {
  const today = new Date
  const [fullYear, month, day] = formatDateForQuery(today).split('-')

  // first day of this month
  const firstDayOfMonth = new Date(fullYear,month-1,1)
  // last day of the month before last month
  const lastDayOfPrevPrevMonth = new Date(fullYear,month-2,0)

  // only fetch repositories from the previous calendar month
  const repoDateQuery = `created:${formatDateForQuery(lastDayOfPrevPrevMonth)}..${formatDateForQuery(firstDayOfMonth)}`
  repoButton.disabled = true
  fetch('https://api.github.com/search/repositories?' + buildFullQueryString(repoDateQuery, 'stars'))
    .then(res => res.json())
    .then(data => {
      store.hotRepos = parseHotRepoResult(data)
      renderRepoTable()
      repoButton.disabled = false
    }).catch( err => {
      store.hotRepos = []
      renderRepoTable()
      repoButton.disabled = false
      console.error(err.message)
    })
}
function updateProlificUsers() {
  const today = new Date
  const [fullYear, month, day] = formatDateForQuery(today).split('-')

  // a year and one day ago 
  const aYearAndADayAgo = new Date(fullYear, month-1, day-366)
  // `+` *requires* `parseInt` to get the math right instead of string concatenation
  const tomorrow = new Date(fullYear, month-1, parseInt(day)+1)

  const githubUserDateQuery = `created:${formatDateForQuery(aYearAndADayAgo)}..${formatDateForQuery(tomorrow)}`

  userButton.disabled = true
  fetch('https://api.github.com/search/users?' + buildFullQueryString(githubUserDateQuery, 'followers'))
    .then(res => res.json())
    .then(data => {
      store.prolificUsers = parseProlificUserResult(data)
      renderUserTable()
      return store.prolificUsers
    })
    .then( users => {
      // cancel active follower count fetches before kicking off new ones
      if (controller) controller.abort()
      updateFollowerCounts(users)
    } )
    .catch( err => {
      store.prolificUsers = []
      renderUserTable()
      userButton.disabled = false
      console.error(err.message)
    })
}

// Attach event handlers
repoButton.addEventListener('click', updateHotRepos)
userButton.addEventListener('click', updateProlificUsers)

// Initial render
renderRepoTable()
renderUserTable()

// Set up polling interval
const intervalId = setInterval( () => {
  if (!Array.isArray(store.prolificUsers)) return
  if (store.prolificUsers.length === 0) return

  // cancel active follower count fetches before kicking off new ones
  if (controller) controller.abort()
  updateFollowerCounts(store.prolificUsers)
}, 1000 * 60 * 2) // 2 minutes

