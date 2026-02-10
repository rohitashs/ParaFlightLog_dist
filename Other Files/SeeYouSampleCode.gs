function processFlightIgc(originalFileId, targetFolderId) {
  // 1. Get the original file and target folder
  var originalFile = DriveApp.getFileById(originalFileId);
  var targetFolder = DriveApp.getFolderById(targetFolderId);
  
  // 2. Make a copy in the public folder
  // (Optional: Rename it to something standard like "YYYY-MM-DD_Location.igc")
  var newFile = originalFile.makeCopy(originalFile.getName(), targetFolder);
  
  // 3. Set permission to "Anyone with the link" (Public View)
  // This is critical for SeeYou Cloud to be able to fetch it
  newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  // 4. Construct the Direct Download URL
  // We use the ID to build the "export=download" link, as getDownloadUrl() 
  // sometimes returns links that require a google login.
  var directLink = "https://drive.google.com/uc?export=download&id=" + newFile.getId();
  
  // 5. Return the SeeYou Cloud link for your spreadsheet
  var seeYouLink = "https://seeyou.cloud/api/open?igc=" + directLink;
  
  return seeYouLink;
}
