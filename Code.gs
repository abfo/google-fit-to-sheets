// add your Google API Project OAuth client ID and client secret here
var ClientID = '';
var ClientSecret = '';

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Google Fit')
      .addItem('Authorize if needed (does nothing if already authorized)', 'showSidebar')
      .addItem('Get Metrics for Yesterday', 'getMetrics')
      .addItem('Get Metrics for past 60 days', 'getHistory')
      .addItem('Reset Settings', 'clearProps')
      .addToUi();
}

function getMetrics() {
  getMetricsForDays(1, 1, 'Metrics');
}

function getHistory() {
  getMetricsForDays(1, 60, 'History');
}

// see step count example at https://developers.google.com/fit/scenarios/read-daily-step-total
// adapted below to handle multiple metrics (steps, weight, distance), only logged if present for day
function getMetricsForDays(fromDaysAgo, toDaysAgo, tabName) {
  var start = new Date();
  start.setHours(0,0,0,0);
  start.setDate(start.getDate() - toDaysAgo);

  var end = new Date();
  end.setHours(23,59,59,999);
  end.setDate(end.getDate() - fromDaysAgo);
  
  var fitService = getFitService();
  
  var request = {
    "aggregateBy": [
      {
        "dataTypeName": "com.google.step_count.delta",
        "dataSourceId": "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps"
      },
      {
        "dataTypeName": "com.google.weight.summary",
        "dataSourceId": "derived:com.google.weight:com.google.android.gms:merge_weight"
      },
      {
        "dataTypeName": "com.google.distance.delta",
        "dataSourceId": "derived:com.google.distance.delta:com.google.android.gms:merge_distance_delta"
      }
    ],
    "bucketByTime": { "durationMillis": 86400000 },
    "startTimeMillis": start.getTime(),
    "endTimeMillis": end.getTime()
  };
  
  var response = UrlFetchApp.fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
    headers: {
      Authorization: 'Bearer ' + fitService.getAccessToken()
    },
    'method' : 'post',
    'contentType' : 'application/json',
    'payload' : JSON.stringify(request, null, 2)
  });
  
  var json = JSON.parse(response.getContentText());
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(tabName);
  
  for(var b = 0; b < json.bucket.length; b++) {
    // each bucket in our response should be a day
    var bucketDate = new Date(parseInt(json.bucket[b].startTimeMillis, 10));
    
    var steps = -1;
    var weight = -1;
    var distance = -1;
    
    if (json.bucket[b].dataset[0].point.length > 0) {
      steps = json.bucket[b].dataset[0].point[0].value[0].intVal;
    }
    
    if (json.bucket[b].dataset[1].point.length > 0) {
      weight = json.bucket[b].dataset[1].point[0].value[0].fpVal;
    }
    
    if (json.bucket[b].dataset[2].point.length > 0) {
      distance = json.bucket[b].dataset[2].point[0].value[0].fpVal;
    }
    
    sheet.appendRow([bucketDate, 
                     steps == -1 ? ' ' : steps, 
                     weight == -1 ? ' ' : weight, 
                     distance == -1 ? ' ' : distance]);
  }
}

// functions below adapted from Google OAuth example at https://github.com/googlesamples/apps-script-oauth2

function getFitService() {
  // Create a new service with the given name. The name will be used when
  // persisting the authorized token, so ensure it is unique within the
  // scope of the property store.
  return OAuth2.createService('fit')

      // Set the endpoint URLs, which are the same for all Google services.
      .setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/auth')
      .setTokenUrl('https://accounts.google.com/o/oauth2/token')

      // Set the client ID and secret, from the Google Developers Console.
      .setClientId(ClientID)
      .setClientSecret(ClientSecret)

      // Set the name of the callback function in the script referenced
      // above that should be invoked to complete the OAuth flow.
      .setCallbackFunction('authCallback')

      // Set the property store where authorized tokens should be persisted.
      .setPropertyStore(PropertiesService.getUserProperties())

      // Set the scopes to request (space-separated for Google services).
      // see https://developers.google.com/fit/rest/v1/authorization for a list of Google Fit scopes
      .setScope('https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read https://www.googleapis.com/auth/fitness.location.read')

      // Below are Google-specific OAuth2 parameters.

      // Sets the login hint, which will prevent the account chooser screen
      // from being shown to users logged in with multiple accounts.
      .setParam('login_hint', Session.getActiveUser().getEmail())

      // Requests offline access.
      .setParam('access_type', 'offline')

      // Forces the approval prompt every time. This is useful for testing,
      // but not desirable in a production application.
      //.setParam('approval_prompt', 'force');
}

function showSidebar() {
  var fitService = getFitService();
  if (!fitService.hasAccess()) {
    var authorizationUrl = fitService.getAuthorizationUrl();
    var template = HtmlService.createTemplate(
        '<a href="<?= authorizationUrl ?>" target="_blank">Authorize</a>. ' +
        'Close this after you have finished.');
    template.authorizationUrl = authorizationUrl;
    var page = template.evaluate();
    SpreadsheetApp.getUi().showSidebar(page);
  } else {
  // ...
  }
}

function authCallback(request) {
  var fitService = getFitService();
  var isAuthorized = fitService.handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput('Success! You can close this tab.');
  } else {
    return HtmlService.createHtmlOutput('Denied. You can close this tab');
  }
}

function clearProps() {
  PropertiesService.getUserProperties().deleteAllProperties();
}
