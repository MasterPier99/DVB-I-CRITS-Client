
/** LCN_services_only
 * set to true to only include services in the selected region that are included in the reevant LCN table.
 * setting this value to false will add all services, but those that are not in the LCN will use channel numbers starting with First_undeclared_channel
 **/
/* const */var LCN_services_only=false;
/* const */var First_undeclared_channel=7000;

var MPEG7_ns = "*"; /* "urn:tva:mpeg7:2008" */
var TVA_ns = "*"; /* "urn:tva:metadata:2024" */
var DVBi_TYPES_ns = "*"; /* "urn:dvb:metadata:servicediscovery-types:2023" */
var DVBi_ns = "*"; /* "urn:dvb:metadata:servicediscovery:2024" */


function parseContentGuideSource(src) {
  var newCS = { id: "", contentGuideURI: null, moreEpisodesURI: null, programInfoURI: null };
  if (src) {
    newCS.id = src.getAttribute("CGSID");

    // Gestione del ScheduleInfoEndpoint con namespace
    var SIEURI = src
      .getElementsByTagNameNS(DVBi_ns, "ScheduleInfoEndpoint")[0]
      .getElementsByTagNameNS(DVBi_TYPES_ns, "URI")[0];
    if (SIEURI && SIEURI.childNodes.length > 0) {
      newCS.contentGuideURI = SIEURI.childNodes[0].nodeValue;
    }

    // Gestione del MoreEpisodesEndpoint con namespace
    var moreEpisodes = src.getElementsByTagNameNS(DVBi_ns, "MoreEpisodesEndpoint");
    if (moreEpisodes.length > 0) {
      var moreEpisodesURI = moreEpisodes[0].getElementsByTagNameNS(DVBi_TYPES_ns, "URI")[0];
      if (moreEpisodesURI && moreEpisodesURI.childNodes.length > 0) {
        newCS.moreEpisodesURI = moreEpisodesURI.childNodes[0].nodeValue;
      }
    }

    // Gestione del ProgramInfoEndpoint con namespace
    var programInfo = src.getElementsByTagNameNS(DVBi_ns, "ProgramInfoEndpoint");
    if (programInfo.length > 0) {
      var programInfoURI = programInfo[0].getElementsByTagNameNS(DVBi_TYPES_ns, "URI")[0];
      if (programInfoURI && programInfoURI.childNodes.length > 0) {
        newCS.programInfoURI = programInfoURI.childNodes[0].nodeValue;
      }
    }
  }
  return newCS;
}


async function parseServiceList(data,dvbChannels,supportedDrmSystems) {
    var i, j, k, l;
    var serviceList = {};
    var list = [];
    serviceList.services = list;
    var parser = new DOMParser();
    var doc = parser.parseFromString(data,"text/xml");
    var ns = doc.documentElement.namespaceURI;
    var howRelatedNamespace = "urn:tva:metadata:2019";
    var howRelatedHref = "urn:dvb:metadata:cs:HowRelatedCS:2019:";
    if(ns == "urn:dvb:metadata:servicediscovery:2020") {
      howRelatedNamespace = "urn:tva:metadata:2019";
      howRelatedHref = "urn:dvb:metadata:cs:HowRelatedCS:2020:";
    } else if(ns == "urn:dvb:metadata:servicediscovery:2023") {
      howRelatedNamespace = "urn:tva:metadata:2023";
      howRelatedHref = "urn:dvb:metadata:cs:HowRelatedCS:2021:";
    } else if(ns == "urn:dvb:metadata:servicediscovery:2023b" ||ns == "urn:dvb:metadata:servicediscovery:2024" ) {
      howRelatedNamespace = "urn:tva:metadata:2024";
      howRelatedHref = "urn:dvb:metadata:cs:HowRelatedCS:2021:";
    }


    var services = getChildElements(doc.documentElement,"Service");

    var contentGuides=[];
    var channelmap = [];
    if(dvbChannels) {
      for(i = 0;i<dvbChannels.length;i++) {
          var dvbChannel = dvbChannels.item(i);
          var triplet = dvbChannel.onid +"."+dvbChannel.tsid+"."+dvbChannel.sid;
          channelmap[triplet] = dvbChannel;
      }
    }
    var defaultContentGuide=parseContentGuideSource(null);
    var contentGuideSource=getChildElements(doc.documentElement,"ContentGuideSource");
    if (contentGuideSource.length>0) {
	defaultContentGuide=parseContentGuideSource(contentGuideSource[0]);
    }

    var contentGuideSources = getChildElements(doc.documentElement,"ContentGuideSourceList");
    if (contentGuideSources.length > 0) {
      var guides=getChildElements(contentGuideSources[0],"ContentGuideSource");
      for (var cs=0; cs < guides.length; cs++) {
        contentGuides.push(parseContentGuideSource(guides[cs]));
      }
    }
    var relatedMaterial1 = getChildElements(doc.documentElement,"RelatedMaterial");
    for(j = 0;j < relatedMaterial1.length;j++) {
        var howRelated1 = relatedMaterial1[j].getElementsByTagNameNS(howRelatedNamespace,"HowRelated")[0].getAttribute("href");
        if(howRelated1 == howRelatedHref+"1001.1") {
            serviceList.image = relatedMaterial1[j].getElementsByTagNameNS(howRelatedNamespace,"MediaLocator")[0].getElementsByTagNameNS(howRelatedNamespace,"MediaUri")[0].childNodes[0].nodeValue;
        }
    }
    var regionList = getChildElements(doc.documentElement,"RegionList");
    if(regionList.length > 0) {
       serviceList.regions = [];
       var regions =  getChildElements(regionList[0],"Region");
       for (i = 0; i < regions.length ;i++) {
          var regionElement = regions[i];
          serviceList.regions.push(parseRegion(regionElement));
          var primaryRegions =  getChildElements(regionElement,"Region");
          for (j = 0; j < primaryRegions.length ;j++) {
            var regionElement2 = primaryRegions[j];
            serviceList.regions.push(parseRegion(regionElement2));
            var secondaryRegions =  getChildElements(regionElement2,"Region");
            for (k = 0; k < secondaryRegions.length ;k++) {
              var regionElement3 = secondaryRegions[k];
              serviceList.regions.push(parseRegion(regionElement3));
              var tertiaryRegions =  getChildElements(regionElement3,"Region");
              for (l = 0; l < tertiaryRegions.length ;l++) {
                var regionElement4 = tertiaryRegions[l];
                serviceList.regions.push(parseRegion(regionElement4));
              }
            }
          }
       }
    }

    var maxLcn = 0;
    var lcnTables = doc.getElementsByTagName("LCNTable");
    var lcnList = lcnTables[0].getElementsByTagName("LCN");
    serviceList.lcnTables = [];
    for (i = 0; i < lcnTables.length ;i++) {
      var lcnTable = {};
      lcnTable.lcn = [];
      var targetRegions =  lcnTables[i].getElementsByTagName("TargetRegion");
      if(targetRegions.length > 0) {
        lcnTable.targetRegions = [];
        for(j = 0;j < targetRegions.length;j++) {
           lcnTable.targetRegions.push(targetRegions[j].childNodes[0].nodeValue);
        }
	lcnTable.defaultRegion=false;
      }
      else {
        lcnTable.defaultRegion=true;
      }
      var lcnList2 = lcnTables[i].getElementsByTagName("LCN");
      for(j = 0; j < lcnList2.length ;j++) {
            var lcn = {};
            lcn.serviceRef = lcnList2[j].getAttribute("serviceRef");
            lcn.channelNumber = parseInt(lcnList2[j].getAttribute("channelNumber"));
            lcnTable.lcn.push(lcn);
      }
      serviceList.lcnTables.push(lcnTable);
    }
    for (i = 0; i < services.length ;i++) {
        var chan = {};

	var myContentGuideSource=services[i].getElementsByTagName("ContentGuideSource");
	if (myContentGuideSource.length > 0) {
	  chan.contentGuideURI = myContentGuideSource[0].getElementsByTagName("ScheduleInfoEndpoint")[0].getElementsByTagName("URI")[0].childNodes[0].nodeValue;
	  var moreEpisodes =  myContentGuideSource[0].getElementsByTagName("MoreEpisodesEndpoint");
	  if(moreEpisodes.length > 0) {
	    chan.moreEpisodesURI = moreEpisodes[0].getElementsByTagName("URI")[0].childNodes[0].nodeValue;
	  }
	  var programInfo =  myContentGuideSource[0].getElementsByTagName("ProgramInfoEndpoint");
	  if(programInfo.length > 0) {
	    chan.programInfoURI = programInfo[0].getElementsByTagName("URI")[0].childNodes[0].nodeValue;
	  }
	}
	else {
          chan.contentGuideURI = defaultContentGuide.contentGuideURI;
          chan.moreEpisodesURI = defaultContentGuide.moreEpisodesURI;
          chan.programInfoURI = defaultContentGuide.programInfoURI;
	}

	var myContentGuideSourceRef=services[i].getElementsByTagName("ContentGuideSourceRef");
	if (myContentGuideSourceRef.length > 0) {
	  var idx=-1;
	  for (var cs2=0; cs2 < contentGuides.length; cs2++) {
	    if (contentGuides[cs2].id == myContentGuideSourceRef[0].childNodes[0].nodeValue) {
		idx=cs2;
		break;
	    }
	  }
	  if (idx != -1) {
	    chan.contentGuideURI = contentGuides[idx].contentGuideURI;
	    chan.moreEpisodesURI = contentGuides[idx].moreEpisodesURI;
	    chan.programInfoURI = contentGuides[idx].programInfoURI;
	  }
	}
        chan.code = i;
        var serviceNames = services[i].getElementsByTagName("ServiceName");
        chan.titles = [];
        for(j = 0;j < serviceNames.length;j++) {
          chan.titles.push(getText(serviceNames[j]));
        }
        chan.title = serviceNames[0].childNodes[0]?serviceNames[0].childNodes[0].nodeValue:".";
        chan.id = services[i].getElementsByTagName("UniqueIdentifier")[0].childNodes[0].nodeValue;
        var providers = services[i].getElementsByTagName("ProviderName");
        if(providers.length > 0) {
          chan.provider = providers[0].childNodes[0].nodeValue;
          chan.providers = [];
          for(j = 0;j < providers.length;j++) {
            chan.providers.push(getText(providers[j]));
          }
        }
        var targetRegions2 = services[i].getElementsByTagName("TargetRegion");
        if(targetRegions2.length > 0) {
          chan.targetRegions = [];
          for(j = 0;j < targetRegions2.length;j++) {
             chan.targetRegions.push(targetRegions2[j].childNodes[0].nodeValue);
          }
        }
        chan.parallelApps = [];
        chan.mediaPresentationApps = [];
        var cgRefs = services[i].getElementsByTagName("ContentGuideServiceRef");
        if(cgRefs && cgRefs.length > 0) {
            chan.contentGuideServiceRef = cgRefs[0].childNodes[0].nodeValue;
        }
        var relatedMaterial = getChildElements(services[i],"RelatedMaterial");
        for(j = 0;j < relatedMaterial.length;j++) {

            var howRelatedNS  = relatedMaterial[j].getElementsByTagNameNS(howRelatedNamespace,"HowRelated")[0];
            if (!howRelatedNS) howRelatedNS=relatedMaterial[j].getElementsByTagNameNS(doc.documentElement.namespaceURI,"HowRelated")[0];
            var howRelatedML  = relatedMaterial[j].getElementsByTagNameNS(howRelatedNamespace,"MediaLocator")[0]
            if (!howRelatedML) howRelatedML  = relatedMaterial[j].getElementsByTagNameNS(doc.documentElement.namespaceURI,"MediaLocator")[0]

            var howRelated = howRelatedNS.getAttribute("href");
            if(howRelated == howRelatedHref+"1001.2") {
                chan.image = howRelatedML.getElementsByTagNameNS(howRelatedNamespace,"MediaUri")[0].childNodes[0].nodeValue;
            }
            if(howRelated == howRelatedHref+"1000.1") {
                chan.out_of_service_image = howRelatedML.getElementsByTagNameNS(howRelatedNamespace,"MediaUri")[0].childNodes[0].nodeValue;
            }
            else if(howRelated == "urn:dvb:metadata:cs:LinkedApplicationCS:2019:1.1") {
                var app = {};
                var mediaUri =  howRelatedML.getElementsByTagNameNS(howRelatedNamespace,"MediaUri")[0];
                if(mediaUri  && mediaUri.childNodes.length > 0) {
                  app.url = mediaUri.childNodes[0].nodeValue;
                  app.contentType = mediaUri.getAttribute("contentType");
                  chan.parallelApps.push(app);
                }
            }
            else if(howRelated == "urn:dvb:metadata:cs:LinkedApplicationCS:2019:1.2") {
                var app2 = {};
                var mediaUri2 =  howRelatedML.getElementsByTagNameNS(howRelatedNamespace,"MediaUri")[0];
                if(mediaUri2 && mediaUri2.childNodes.length > 0) {
                  app2.url = mediaUri2.childNodes[0].nodeValue;
                  app2.contentType = mediaUri2.getAttribute("contentType");
                  chan.mediaPresentationApps.push(app2);
                }
            }
        }
        var serviceInstances = services[i].getElementsByTagName("ServiceInstance");
        //console.log(IdentifierBasedDeliveryParameters);
        var instances = [];
        var sourceTypes = [];
        var highestPriority = 10000; // Priorità inizializzata a un valore molto basso
        var selectedInstance = null;

        for (j = 0; j < serviceInstances.length; j++) {
          var currentPriority = parseInt(serviceInstances[j].getAttribute("priority"), 10);
          //var currentcontentType = IdentifierBasedDeliveryParameters.getAttribute("contentType");
          //console.log(currentcontentType);
          var instance = {};

          // Estrai i titoli del DisplayName
          var displayNames = serviceInstances[j].getElementsByTagName("DisplayName");
          instance.titles = [];
          for (k = 0; k < displayNames.length; k++) {
              instance.titles.push(getText(displayNames[k]));
          }
          instance.priority = currentPriority;
          instance.contentProtection = [];
          instance.parallelApps = [];
          instance.mediaPresentationApps = [];

          // Gestione del ContentProtection
          var contentProtectionElements = getChildElements(serviceInstances[j], "ContentProtection");
          for (k = 0; k < contentProtectionElements.length; k++) {
              for (l = 0; l < contentProtectionElements[k].childNodes.length; l++) {
                  if (contentProtectionElements[k].childNodes[l].nodeName === "DRMSystemId") {
                      var drmSystem = contentProtectionElements[k].childNodes[l];
                      var drm = {};
                      drm.encryptionScheme = drmSystem.getAttribute("encryptionScheme");
                      drm.drmSystemId = drmSystem.getElementsByTagName("DRMSystemId")[0].childNodes[0].nodeValue;
                      drm.cpsIndex = drmSystem.getAttribute("cpsIndex");
                      instance.contentProtection.push(drm);
                  }
              }
          }

          // Verifica compatibilità DRM
          if (supportedDrmSystems && instance.contentProtection.length > 0) {
              var supported = false;
              for (k = 0; k < instance.contentProtection.length; k++) {
                  for (l = 0; l < supportedDrmSystems.length; l++) {
                      if (instance.contentProtection[k].drmSystemId.toLowerCase() === supportedDrmSystems[l].toLowerCase()) {
                          supported = true;
                          break;
                      }
                  }
                  if (supported) break;
              }
              if (!supported) continue;
          }

          // Gestione dell'Availability
          var availability = getChildElements(serviceInstances[j], "Availability");
          instance.availability = null;
          if (availability.length > 0) {
              instance.availability = [];
              var periods = getChildElements(availability[0], "Period");
              for (k = 0; k < periods.length; k++) {
                  var period = {};
                  period.validFrom = periods[k].getAttribute("validFrom");
                  period.validTo = periods[k].getAttribute("validTo");
                  period.intervals = [];
                  var intervals = getChildElements(periods[k], "Interval");
                  for (l = 0; l < intervals.length; l++) {
                      var interval = {};
                      interval.days = intervals[l].getAttribute("days");
                      interval.recurrence = intervals[l].getAttribute("recurrence");
                      interval.startTime = intervals[l].getAttribute("startTime");
                      interval.endTime = intervals[l].getAttribute("endTime");
                      period.intervals.push(interval);
                  }
                  instance.availability.push(period);
              }
          }

          // Gestione delle URI per ogni protocollo
          if (currentPriority < highestPriority) {
              var namespaceURI = "urn:dvb:metadata:servicediscovery:2024";

            try {
                let url = null;
                let sourceType = null;

                // DASH Delivery
                if (serviceInstances[j].getElementsByTagName("DASHDeliveryParameters").length > 0) {
                    var tryURI = serviceInstances[j].getElementsByTagName("URI")[0] || serviceInstances[j].getElementsByTagName("dvbi-types:URI")[0];
                    if (tryURI) {
                        url = tryURI.childNodes[0].nodeValue;
                        sourceType = "DVB-DASH";
                    }
                }

                // Other Delivery Parameters
                if (!url && serviceInstances[j].getElementsByTagNameNS(namespaceURI, "OtherDeliveryParameters").length > 0) {
                    var tryURI = serviceInstances[j].getElementsByTagNameNS(namespaceURI, "OtherDeliveryParameters")[0];
                    if (tryURI) {
                        url = tryURI.textContent.trim();
                        sourceType = "HLS";
                    }
                }

                // Identifier-Based Delivery Parameters
                if (!url && serviceInstances[j].getElementsByTagName("IdentifierBasedDeliveryParameters").length > 0) {
                    var tryURI = serviceInstances[j].getElementsByTagName("IdentifierBasedDeliveryParameters")[0];
                    if (tryURI) {
                        url = tryURI.childNodes[0].nodeValue;
                        sourceType = "5G Broadcast";
                    }
                }

                // SATIP Delivery
                if (!url && serviceInstances[j].getElementsByTagName("SATIPDeliveryParameters").length > 0) {
                    var tryURI = serviceInstances[j].getElementsByTagName("QueryParameters")[0];
                    if (tryURI) {
                        url = tryURI.childNodes[0].nodeValue;
                        sourceType = "SATIP";
                    }
                }

                // Se un URL è stato trovato, verifica che funzioni
                if (url && await testURL(url)) {
                  console.log(`URL valido per il protocollo ${sourceType} con priorità ${currentPriority}: ${url}`);
                  try {
                      // Invia l'URL al server 5G Broadcast
                      const serverUrl = await sendServerRequest(instance, url);

                      if (serverUrl) {
                          console.log("Trasmissione avviata con URL restituito dal server:", serverUrl);
                          instance.dashUrl = serverUrl; // Usa l'URL restituito dal server
                          sourceTypes = [sourceType];
                          selectedInstance = instance;
                          highestPriority = currentPriority; // Aggiorna priorità

                          // Opzionalmente, puoi aggiungere logica per il player
                          // player.attachSource(serverUrl);
                      } else {
                          console.error("Trasmissione non avviata. Il server non ha restituito un URL valido.");
                          $("#notification").text("Errore: il server non ha restituito un URL valido.");
                          $("#notification").show();
                          setTimeout(function () {
                              $("#notification").hide();
                          }, 5000);
                      }
                  } catch (error) {
                      console.error("Errore durante l'invio della richiesta al server 5G Broadcast:", error);
                      $("#notification").text("Errore durante la connessione al server.");
                      $("#notification").show();
                      setTimeout(function () {
                          $("#notification").hide();
                      }, 5000);
                  }
              } else {
                  console.log(`URL non valido o non trovato per priorità ${currentPriority}`);
              }

            } catch (e) {
                console.error("Errore durante il controllo del protocollo:", e);
            }
        }
    }

    // Aggiungi l'istanza selezionata alla lista finale
    if (selectedInstance) {
        instances.push(selectedInstance);
        console.log(`Selezionato protocollo con priorità più alta (${highestPriority}) per il servizio.`);
    }


        for(j = 0;j < lcnList.length;j++) {
            if(lcnList[j].getAttribute("serviceRef") == chan.id) {
                chan.lcn = parseInt(lcnList[j].getAttribute("channelNumber"));
                if(chan.lcn > maxLcn) {
                    maxLcn = chan.lcn;
                }
                break;
            }
        }
        chan.epg = [];
        chan.serviceInstances =instances;
        chan.sourceTypes =sourceTypes.join('/');
        list.push(chan);
    }
    for (i = 0; i < list.length ;i++) {
        if(!list[i].lcn) {
            list[i].lcn = ++maxLcn;
        }
    }
    return serviceList;
}

/**
 * Return the xml:lang value for the element, recursing upward if not specified
 * @param {DOM Element} element node in which to look for an xml:lang attribute, and if not, recurse upward
 * @returns the xml:lang value of the element, or of the first ancestor element where it is defined, or 'default' if never speified (should not happen in TV Anytime)
 */
 function elementLanguage(element) {
  if (element == null)
    return 'default';
  var lang=element.getAttributeNS("http://www.w3.org/XML/1998/namespace","lang");
  if (lang)
    return lang;
  else
    return elementLanguage(element.parentElement);
}

function getText(element) {
  var text = {};
  /*  PH: should look for a parent, grandparent etc language (thats how TV-Anytime defines it). Top <TVAMain> elment always has xml:lang
  var lang = element.getAttributeNS("http://www.w3.org/XML/1998/namespace","lang");
  if(!lang) {
    lang = "default";
  }
  text.lang = lang;
  */
  text.lang =  elementLanguage(element);
  if (element.childNodes[0]) text.text = element.childNodes[0].nodeValue ;
    else text.text = ".";
  return text;
}

function parseRegion(regionElement) {
  var region = {}, j;
  region.countryCodes = regionElement.getAttribute("countryCodes");
  region.regionID = regionElement.getAttribute("regionID");
  var names = getChildElements(regionElement,"RegionName");
  if(names.length == 1) {
    region.regionName = names[0].childNodes[0].nodeValue;
  }
  else if(names.length > 1) {
    region.regionNames = [];
    for(j = 0;j < names.length;j++) {
      region.regionNames.push(getText(names[j]));
    }
  }
  var wildcardPostcodes = getChildElements(regionElement,"WildcardPostcode");
  if(wildcardPostcodes.length > 0) {
    region.wildcardPostcodes = [];
    for(j = 0;j < wildcardPostcodes.length;j++) {
      region.wildcardPostcodes.push(wildcardPostcodes[j].childNodes[0].nodeValue);
    }
  }
  var postcodes = getChildElements(regionElement,"Postcode");
  if(postcodes.length > 0) {
    region.postcodes = [];
    for(j = 0;j < postcodes.length;j++) {
      region.postcodes.push(postcodes[j].childNodes[0].nodeValue);
    }
  }
  var postcodeRanges = getChildElements(regionElement,"PostcodeRange");
  if(postcodeRanges.length > 0) {
    region.postcodeRanges = [];
    for(j = 0;j < postcodeRanges.length;j++) {
      var range = {};
      range.from = postcodeRanges[j].getAttribute("from");
      range.to = postcodeRanges[j].getAttribute("to");
      region.postcodeRanges.push(range);
    }
  }
  var coordinates = getChildElements(regionElement,"Coordinates");
  if(coordinates.length > 0) {
    region.coordinates = [];
    for(j = 0;j < coordinates.length;j++) {
      var coordinate = {};
      coordinate.latitude = getChildElements(coordinates[j],"Latitude")[0].childNodes[0].nodeValue;
      coordinate.longitude = getChildElements(coordinates[j],"Longitude")[0].childNodes[0].nodeValue;
      coordinate.radius = getChildElements(coordinates[j],"Radius")[0].childNodes[0].nodeValue;
      region.coordinates.push(coordinate);
    }
  }
  return region;
}

function findRegionFromPostCode(serviceList,postCode) {
  for (var i = 0; i < serviceList.regions.length ;i++) {
    var region = serviceList.regions[i], j;
    if(region.postcodes) {
      for (j = 0; j < region.postcodes.length ;j++) {
        if(region.postcodes[j] == postCode) {
          return region;
        }
      }
    }
    if(region.postcodeRanges) {
      for (j = 0; j < region.postcodeRanges.length ;j++) {
        if(matchPostcodeRange(region.postcodeRanges[j],postCode)) {
          return region;
        }
      }
    }
    if(region.wildcardPostcodes) {
      for (j = 0; j < region.wildcardPostcodes.length ;j++) {
        if(matchPostcodeWildcard(region.wildcardPostcodes[j],postCode)) {
          return region;
        }
      }
    }
  }
  return null;
}

function matchPostcodeRange(range,postCode) {
    if(range.from > postCode || range.to < postCode) {
      return false;
    }
    return true;
}

function matchPostcodeWildcard(wildcard,postCode) {
    var wildcardIndex = wildcard.indexOf("*");
    if(wildcardIndex == wildcard.length-1) {
      //Wildcard is in the end, check that the postcode
      //starts with the wildcard
      var wildcardMatch = wildcard.substring(0,wildcard.length-1);
      if(postCode.indexOf(wildcardMatch) == 0) {
        return true;
      }
    }
    else if (wildcardIndex == 0) {
      var wildcardMatch2 = wildcard.substring(1,wildcard.length);
      if(postCode.indexOf(wildcardMatch2, postCode.length - wildcardMatch2.length) !== -1) {
        return true;
      }
    }
    else if(wildcardIndex != -1) {
      var startMatch =  wildcard.substring(0,wildcardIndex);
      var endMatch = wildcard.substring(wildcardIndex+1,wildcard.length);
      if(postCode.indexOf(startMatch) == 0 && postCode.indexOf(endMatch, postCode.length - endMatch.length) !== -1) {
        return true;
      }
    }
    return false;
}

function selectServiceListRegion(serviceList,regionId) {
  var lcnTable = null, i, j;
  var defaultName="!"+i18n.getString('default_region')+"!";
  for(i = 0;i<serviceList.lcnTables.length;i++) {
    var table = serviceList.lcnTables[i];
    if (regionId==defaultName && table.defaultRegion==true) {
      lcnTable = table;
      break;
    }
    if (table.hasOwnProperty('targetRegions')) {
      for(j = 0;j<table.targetRegions.length;j++) {
        if(table.targetRegions[j] == regionId) {
          lcnTable = table;
          break;
        }
      }
    }
    if(lcnTable != null) {
      break;
    }
  }
  if(lcnTable == null) {
    throw "No LCN table found";
  }
  var validServices = [];
  var unallocatedLCN=First_undeclared_channel;

  for(i = 0;i<serviceList.services.length;i++) {
    var service = serviceList.services[i];
    var valid = false;
    if(service.targetRegions) {
      for(j = 0;j<service.targetRegions.length;j++) {
        if(service.targetRegions[j] == regionId) {
          valid = true;
          break;
        }
      }
    }
    else {
      valid = true;
    }
    if(valid) {
      var inLCN=false;
      service.lcn = -1;
      for(j = 0;j < lcnTable.lcn.length;j++) {
          if(lcnTable.lcn[j].serviceRef == service.id) {
              service.lcn = lcnTable.lcn[j].channelNumber;
	      inLCN=true;
              break;
          }
      }
      if (inLCN || (!inLCN && !LCN_services_only)) {
         if (service.lcn == -1)
      	   service.lcn = unallocatedLCN++;
         validServices.push(service);
      }
    }
  }
  serviceList.services = validServices;
}

function getChildElements(parent,tagName) {
  var elements= [];
  for(var i = 0; i < parent.childNodes.length; i++)
  {
    if(parent.childNodes[i].nodeType == 1 && parent.childNodes[i].tagName == tagName) {
      elements.push(parent.childNodes[i]);
    }
  }
  return elements;
}

function generateServiceListQuery(baseurl,providers,language,genre,targetCountry,regulatorListFlag) {
    var query = baseurl;
    var parameters = [], i;
    if(Array.isArray(providers) && providers.length > 0) {
        for(i = 0; i < providers.length;i++) {
            if(providers[i] !== "") {
                parameters.push("ProviderName[]="+providers[i]);
            }
        }
    }
    else if(providers != null && providers !== ""){
        parameters.push("ProviderName="+providers);
    }

    if(Array.isArray(language) && language.length > 0) {
        for(i = 0; i < language.length;i++) {
            if(language[i] !== "") {
                parameters.push("Language[]="+language[i]);
            }
        }
    }
    else if(language != null && language !== ""){
        parameters.push("Language="+language);
    }

    if(Array.isArray(genre) && genre.length > 0) {
        for(i = 0; i < genre.length;i++) {
            if(genre[i] !== "") {
                parameters.push("Genre[]="+genre[i]);
            }
        }
    }
    else if(genre != null && genre !== ""){
        parameters.push("Genre="+genre);
    }

    if(Array.isArray(targetCountry) && targetCountry.length > 0) {
        for(i = 0; i < targetCountry.length;i++) {
            if(targetCountry[i] !== "") {
                parameters.push("TargetCountry[]="+targetCountry[i]);
            }
        }
    }
    else if(targetCountry != null && targetCountry !== ""){
        parameters.push("TargetCountry="+targetCountry);
    }

    if(regulatorListFlag === true) {
        parameters.push("regulatorListFlag=true");
    }
    if(parameters.length > 0) {
        query += "?"+parameters.join('&');
    }
    return query;

}

function parseServiceListProviders(data) {
  var providerslist = [];
  var parser = new DOMParser();
  var doc = parser.parseFromString(data,"text/xml");
  var ns   = doc.documentElement.namespaceURI;
  var sld1 = doc.documentElement.getAttribute("xmlns:dvbi-types");
  var sld2 = doc.documentElement.getAttribute("xmlns:dvbisd");
  if(!ns)   { ns = "urn:dvb:metadata:servicelistdiscovery:2023"; } //Fallback value
  if(!sld1) { sld1 = "urn:dvb:metadata:servicediscovery:2023"; } //Fallback value
  if(!sld2) { sld2 = "urn:dvb:metadata:servicediscovery:2023"; } //Fallback value
  var providers = doc.getElementsByTagNameNS(ns,"ProviderOffering");
  for(var i = 0;i < providers.length;i++) {
    var providerInfo = providers[i].getElementsByTagNameNS(ns,"Provider");
    var info = {};
    if(providerInfo.length > 0) {
        info["name"] = providerInfo[0].getElementsByTagNameNS(ns,"Name")[0].childNodes[0].nodeValue;
    }
    var lists = providers[i].getElementsByTagNameNS(ns,"ServiceListOffering");
    var servicelists = [];
    info["servicelists"] = servicelists;
    for(var j = 0;j < lists.length;j++) {
        var list = {};
        var           tryName = lists[j].getElementsByTagNameNS(ns,"ServiceListName")[0];
        if (!tryName) tryName = lists[j].getElementsByTagNameNS(sld1,"ServiceListName")[0];
        if (!tryName) tryName = lists[j].getElementsByTagNameNS(sld2,"ServiceListName")[0];
        list["name"] = tryName.childNodes[0].nodeValue;

        var         SLURI = lists[j].getElementsByTagNameNS(ns  ,"ServiceListURI")[0];
        if (!SLURI) SLURI = lists[j].getElementsByTagNameNS(sld1,"ServiceListURI")[0];
        if (!SLURI) SLURI = lists[j].getElementsByTagNameNS(sld2,"ServiceListURI")[0];

        var          tryURI = SLURI.getElementsByTagNameNS(ns  ,"URI")[0];
        if (!tryURI) tryURI = SLURI.getElementsByTagNameNS(sld1,"URI")[0];
        if (!tryURI) tryURI = SLURI.getElementsByTagNameNS(sld2,"URI")[0];

        list["url"] = tryURI.childNodes[0].nodeValue;
        servicelists.push(list);
    }
    providerslist.push(info);
  }
  return providerslist;

}

getParentalRating = function(href){
    if(href == "urn:fvc:metadata:cs:ContentRatingCS:2014-07:no_parental_controls") {
        return "None";
    }
    else if(href == "urn:fvc:metadata:cs:ContentRatingCS:2014-07:fifteen") {
        return "15";
    }
    else {
        return "Unknown";
    }
};

function isServiceInstanceAvailable(instance) {
  if(instance.availability) {
    var now = new Date();
    now.setMilliseconds(0);
    for(var i = 0; i < instance.availability.length;i++) {
      var period = instance.availability[i];
      if(period.validFrom) {
        if(new Date(period.validFrom) > now) {
          continue;
        }
      }
      if(period.validTo) {
        if(new Date(period.validTo) < now) {
          continue;
        }
      }
      if(period.intervals) {
        for(var j = 0; j < period.intervals.length;j++) {
          var interval = period.intervals[j];
          if(isIntervalNow(interval,now)) {
            return true;
          }
        }
      }
      else {
        return true;
      }
    }
    return false;
  }
  return true;
}

function isIntervalNow(interval,now) {
   if(interval.days) {
    var day = now.getDay();
    //JS days are 0..6 starting from sunday
    //Availability days are 1..7 starting from monday
    //So change sunday from 0 to 7
    if(day == 0) {
      day = 7;
    }
    day = day.toString();
    if(interval.days.indexOf(day) == -1) {
      return false;
    }
  }
  if(interval.startTime) {
    if(parseIntervalTime(interval.startTime) > now) {
      return false;
    }
  }
  if(interval.endTime) {
    if(parseIntervalTime(interval.endTime) <= now) {
      return false;
    }
  }
  return true;
}

function parseIntervalTime(time,day) {
  if(time.length == 9 && time.charAt(8) == 'Z') {
    var date = new Date();
    var timeparts = time.substring(0,8).split(":");
    date.setUTCHours(parseInt(timeparts[0]));
    date.setUTCMinutes(parseInt(timeparts[1]));
    date.setUTCSeconds(parseInt(timeparts[2]));
    date.setMilliseconds(0);
    return date;
  }
  return null;
}

var dvb_i_language_list = {
  "en": "English",
  "de" : "Deutsch",
  "fi":"Suomi",
  "zh":"Chinese"
};

function getLocalizedText(texts,lang) {
  if(texts.length == 1) {
    return texts[0].text;
  }
  else if(texts.length > 1){
    var defaultTitle = null;
    for(var i = 0;i < texts.length;i++) {
      if(texts[i].lang == lang) {
        return texts[i].text;
      }
      else if(texts[i].lang == "default") {
        defaultTitle = texts[i].text;
      }
    }
    if(defaultTitle != null) {
      return defaultTitle;
    }
    else {
      return texts[0].text;
    }
  }
  return null;
}

var creditsTypes = {
  "urn:tva:metadata:cs:TVARoleCS:2011:V20":"prod_co",
  "urn:tva:metadata:cs:TVARoleCS:2011:AD6":"presenter",
  "urn:mpeg:mpeg7:cs:RoleCS:2001:ACTOR":"actor"
};


async function testURL(url) {
  try {
      const response = await fetch(url, { method: "HEAD" });
      return response.ok; // true se lo status è 200-299
  } catch (error) {
      console.error(`Errore durante il test dell'URL ${url}:`, error);
      return false;
  }
}
