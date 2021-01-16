// used with the additional task for Home Based Care/Home Isolation. Based on Config-MSF code
const descriptiveContactLabel = (contact, report) => {
const firstname = getFields(report,'contact.name');
const lastname = getFields(report, 'contact.surname');
const district = getFields(report, 'contact.town');
const phone = getFields(report, 'contact.phone');

const fullname = (lastname && firstname) ? lastname + ' ' + firstname : (lastname || firstname) ;

const label = (fullname && district) ? fullname + ' - ' + district : (fullname || phone) ;

return label;
};

// re look at the code block - might not be necessary
const completeEditableContent = (content, contact, report) => {
  content.covid_symptoms = {};
  content.covid_symptoms =  getFields(report,'covid_symptoms.symptoms');
  content.covid_symptoms.call_outcome =  getFields(report ,'covid_symptoms.call_outcome');
  return content;
};

const getFields = (report, ...fields) => {
const fieldName = fields.find(field => Utils.getField(report, field));
if(fieldName === undefined){ return undefined; }
return Utils.getField(report, fieldName);
};

const lghFollowupTemplate = (name, source, userType, colour, criteria) => ({
  name: `${name}_${colour}`,
  icon: `icon-warning-${colour}`,
  title: `task.${name}.title`,
  contactLabel: descriptiveContactLabel,
  appliesTo: 'reports',
  appliesToType: [source],
  appliesIf: (contact, report) => {
    const symptoms = getFields(report,'covid_symptoms.symptoms') || '';
    const symptomCount = symptoms.split(' ').length;
    //const alreadyAssigned = Utils.getField(report,'g_action.action') === 'assign'; // for older reports
    return criteria(symptomCount) && userHasParent(userType); // && !alreadyAssigned;
  },
  resolvedIf: (contact, report, event, dueDate) => {
    const relevantReports = contact.reports.filter(r =>
      Utils.getField(r, 'inputs.source_id') === report._id ||
      r.source_id === report._id
    );

    const isFormSubmittedInWindow = formName => Utils.isFormSubmittedInWindow(
      relevantReports,
      formName,
      Utils.addDate(dueDate, -event.start).getTime(),
      Utils.addDate(dueDate, event.end + 1).getTime()
    );

    return isFormSubmittedInWindow(name) || isFormSubmittedInWindow(`${name}_stub`);
  },
  actions: [{
    form: name,
    label: 'Followup',
    modifyContent: completeEditableContent
  }],
  priority: {
    level: 'high',
    label: `task.${name}-${colour}.label`
  },
  events: [{
    start: 0,
    end: 1000,
    dueDate: (event, contact, report) => {
      const symptoms = getFields(report,'covid_symptoms.symptoms') || '';
      const symptomCount = Math.min(symptoms.split(' ').length, 3);

      // sorting ignores when the report was made
      return Utils.addDate(new Date('2021-01-16'), -symptomCount);
    },
  }],
});

const userHasParent = userType => user && user.parent && user.parent.contact_type === userType;

module.exports = [
  lghFollowupTemplate(
    'covid_symptoms_followup',
    'covid_symptoms_screening',
    'black',
    symptomCount => symptomCount <= 1,
  ),
  lghFollowupTemplate(
    'covid_symptoms_followup',
    'covid_symptoms_screening',
    'ambre',
    symptomCount => symptomCount === 2,
  ),
  lghFollowupTemplate(
    'covid_symptoms_followup',
    'covid_symptoms_screening',
    'red',
    symptomCount => symptomCount >= 3,
  ),
  lghFollowupTemplate(
    'covid_symptoms_followup',
    'covid_symptoms_screening',
    'black',
    symptomCount => symptomCount <= 1,
  ),
  lghFollowupTemplate(
    'covid_symptoms_followup',
    'covid_symptoms_screening',
    'ambre',
    symptomCount => symptomCount === 2,
  ),
  lghFollowupTemplate(
    'covid_symptoms_followup',
    'covid_symptoms_screening',
    'red',
    symptomCount => symptomCount >= 3,
  ),
  /****
   Use case :  RDT screening
   1. Followup after positive RDT
   ****/

  // 1. Positive Rdt follow-up
  {
    name: 'covid-rdt-followup',
    icon: 'icon-healthcare',
    title: 'task.covid_followup.title',
    appliesTo: 'contacts',
    appliesToType: ['person'],
    appliesIf: function (c) {

      this.mostRecentRdt = Utils.getMostRecentReport(c.reports, 'covid_rdt');
      return this.mostRecentRdt && Utils.getField(this.mostRecentRdt, 'test_result') === 'positive';
    },
    resolvedIf: function (c, r, event) {
      const startTime = Utils.addDate(event.dueDate(c, r), -event.start);
      const endTime = Utils.addDate(event.dueDate(c, r), event.end + 1);

      const reportsAfterRdt = c.reports.filter(report => report.reported_date >= this.mostRecentRdt.reported_date);
      return Utils.isFormSubmittedInWindow(reportsAfterRdt, 'covid_rdt_followup', startTime, endTime);
    },
    events: [{
      start: 1,
      end: 3,
      dueDate: function() {
        return Utils.addDate(new Date(this.mostRecentRdt.reported_date), 1);
      },
    }],
    actions: [{
      type: 'contacts',
      form: 'covid_rdt_followup',
      label: 'task.covid_followup.title',
    }],
  },

  /****
   Use case :  C-EBS
   1. Supervisor Verification after signal 8
   2. Investigation of Sub - district after Verified signal 8
   ****/

  // 1. Cha verification
  {
    name: 'cha-signal-verification',
    icon: 'icon-healthcare',
    title: 'task.cha_verification.title',
    appliesTo: 'contacts',
    appliesToType: undefined,
    appliesIf: function (c) {
      const isCha = user.parent && user.parent.type === 'health_center';
      this.mostRecent8 = Utils.getMostRecentReport(c.reports, '8');
      return isCha && this.mostRecent8 ;
    },
    resolvedIf: function (c, r, event) {
      const startTime = Utils.addDate(event.dueDate(c, r), -event.start);
      const endTime = Utils.addDate(event.dueDate(c, r), event.end + 1);

      const reportsAfter8 = c.reports.filter(report => report.reported_date >= this.mostRecent8.reported_date);
      return Utils.isFormSubmittedInWindow(reportsAfter8, 'cha_signal_verification', startTime, endTime);
    },
    events: [{
      start: 1,
      end: 3,
      dueDate: function() {
        return Utils.addDate(new Date(this.mostRecent8.reported_date), 1);
      },
    }],
    actions: [{
      type: 'report',
      form: 'cha_signal_verification',
      label: 'Cha verification',
      modifyContent: function (content,contact) {
        console.log(JSON.stringify(contact));
        const report = this.mostRecent8;
        content.id_signal = report.patient_id;
        //content.chw_id = contact._id;
        //content.patient_id = contact._id;
        contact.contact.name = 'Signal ID: ' + ' ' +contact.contact.patient_id;

      },
    }],
  },

  // 2. Scdsc investigation
  {
    name: 'scdsc-investigation',
    icon: 'icon-healthcare',
    title: 'task.scdsc_investigation.title',
    appliesTo: 'contacts',
    appliesToType: undefined,
    appliesIf: function (c) {
      const isScdsc = user.parent && user.parent.type === 'district_hospital';
      this.mostRecentChaVerification = Utils.getMostRecentReport(c.reports, 'cha_signal_verification');
      return isScdsc && this.mostRecentChaVerification ;
    },
    resolvedIf: function (c, r, event) {
      const startTime = Utils.addDate(event.dueDate(c, r), -event.start);
      const endTime = Utils.addDate(event.dueDate(c, r), event.end + 1);

      const reportsAfterChaVerification = c.reports.filter(report => report.reported_date >= this.mostRecentChaVerification.reported_date);
      return Utils.isFormSubmittedInWindow(reportsAfterChaVerification, 'scdsc_investigation', startTime, endTime);
    },
    events: [{
      start: 1,
      end: 3,
      dueDate: function() {
        return Utils.addDate(new Date(this.mostRecentChaVerification.reported_date), 1);
      },
    }],
    actions: [{
      type: 'report',
      form: 'scdsc_investigation',
      label: 'Scdsc investigation',
      modifyContent: function (content,contact) {
        const report = this.mostRecentChaVerification;
        content.id_signal = report.fields.patient_id;
        contact.contact.name = 'Signal ID: ' + ' ' +contact.contact.patient_id;
      },
    }],
  },

  /****
   Use case :  Contact Tracing
   1. Followup with a contact after tracer assignement
   1. Checking the contact after they reported a symptom
   1. Taking over a contact after they are confirmed as symptomatic
   ****/

  // 1. Trace Follow-up
  {
    name: 'trace_follow_up',
    icon: 'icon-healthcare',
    title: 'task.trace_follow_up.title',
    appliesTo: 'contacts',
    appliesToType: ['person'],
    appliesIf: function (contact) {
      return  !!contact.contact.covid_patient && user.role === 'tracer' ;
    },
    resolvedIf: function (contact) {
      this.mostRecentTraceFollowUp = Utils.getMostRecentReport(contact.reports, 'covid_trace_follow_up');
      return this.mostRecentTraceFollowUp &&
          ['contacted', 'stop'].includes(Utils.getField(this.mostRecentTraceFollowUp, 'trace.result'));
    },
    events: [{
      days: 0,
      start: 0,
      end: 30
    }],
    actions: [{
      type: 'report',
      form: 'covid_trace_follow_up',
      label: 'task.trace_follow_up.title',
    }],
  },

  // 2. Symptoms check
  {
    name: 'symptoms_check',
    icon: 'icon-healthcare',
    title: 'task.symptoms_check.title',
    appliesTo: 'contacts',
    appliesToType: ['person'],
    appliesIf: function (contact) {
      this.mostRecentQuarantine_follow_up= Utils.getMostRecentReport(contact.reports, 'QUARANTINE_FOLLOW_UP');
      return !!this.mostRecentQuarantine_follow_up && (Utils.getField(this.mostRecentQuarantine_follow_up, 'symptoms_check') === true || Utils.getField(this.mostRecentQuarantine_follow_up, 'symptoms_check')==='1');
    },
    resolvedIf: function (contact) {
      this.mostRecentSymCheck = Utils.getMostRecentReport(contact.reports, 'symptoms_check');
      return !!this.mostRecentSymCheck && Utils.getField(this.mostRecentSymCheck, 'symptom_check.symptom') === 'yes';
    },
    events: [{
      days: 0,
      start: 0,
      end: 3
    }],
    actions: [{
      type: 'report',
      form: 'symptoms_check',
      label: 'task.symptoms_check.title',
    }],
  },

  // 3. Symptomatic contact follow up
  {
    name: 'symptomatic_contact_follow_up',
    icon: 'icon-healthcare',
    title: 'task.symptomatic_contact_follow_up.title',
    appliesTo: 'contacts',
    appliesToType: undefined,
    appliesIf: function (contact) {
      this.mostRecentSymptomsCheck = Utils.getMostRecentReport(contact.reports, 'symptoms_check');
      return !!this.mostRecentSymptomsCheck && Utils.getField(this.mostRecentSymptomsCheck, 'symptom_check.symptom') === 'yes' && user.role === 'data_entry';
    },
    resolvedIf: function (c, r, event) {
      const startTime = Utils.addDate(event.dueDate(c, r), -event.start);
      const endTime = Utils.addDate(event.dueDate(c, r), event.end + 1);

      const reportsAfterQuarantineFollowUp = c.reports.filter(report => report.reported_date >= this.mostRecentSymptomsCheck.reported_date);
      return Utils.isFormSubmittedInWindow(reportsAfterQuarantineFollowUp, 'symptomatic_contact_follow_up', startTime, endTime);
    },
    events: [{
      start: 1,
      end: 3,
      dueDate: function() {
        return Utils.addDate(new Date(this.mostRecentSymptomsCheck.reported_date), 1);
      },
    }],
    actions: [{
      type: 'report',
      form: 'symptomatic_contact_follow_up',
      label: 'task.symptomatic_contact_follow_up.title',
    }],
  },

// Have a look at the below tasks and associated forms and  make sure the code and fields are correct - 16/01/2021
  /****
   Use case :  Home Based Care (Home Isolation)
   1. Followup with a patient after home isolation - daily symptoms check
   2. Follow up COVID Test result
   3. Outcome follow up
   ****/

  // 1. Covid-19 Patient daily symptoms follow up
  {
    name: 'daily_symptoms_follow_up',
    icon: 'icon-healthcare',
    title: 'task.daily_symptoms_follow_up.title',
    appliesTo: 'contacts',
    appliesToType: undefined,
    appliesIf: function (contact) {
      this.mostRecentSwabResult = Utils.getMostRecentReport(contact.reports, 'covid_swab_result');
      return !!this.mostRecentSwabResult && Utils.getField(this.mostRecentSwabResult, 'covid_swab_result.result') === 'positive' && user.role === 'chw_supervisor';
    },
    resolvedIf: function (c, r, event) {
      const startTime = Utils.addDate(event.dueDate(c, r), -event.start);
      const endTime = Utils.addDate(event.dueDate(c, r), event.end + 1);

      const reportsAfterIsolationFollowUp = c.reports.filter(report => report.reported_date >= this.mostRecentSwabResult.reported_date);
      return Utils.isFormSubmittedInWindow(reportsAfterIsolationFollowUp, 'covid_symptoms_followup', startTime, endTime);
    },
    events: [{
      start: 1,
      end: 3,
      dueDate: function() {
        return Utils.addDate(new Date(this.mostRecentSwabResult.reported_date), 1);
      },
    }],
    actions: [{
      type: 'report',
      form: 'covid_symptoms_followup',
      label: 'task.isolated_contact_follow_up.title',
    }],
  }

  // 2. Sampling followup
  {
    name: 'sampling-follow-up',
    icon: 'icon_sample',
    title: 'task.sampling-follow-up.title',
    appliesTo: 'reports',
    appliesToType: ['investigation'],
    contactLabel: descriptiveContactLabel,
    appliesIf: (contact, report) => {
      return Utils.getField(report, 'investigation.sample_collection') === 'yes' && userHasParent('investigator');
    },
    resolvedIf: (contact, report, event, dueDate) => {
      const relevantReports = contact.reports.filter(r => Utils.getField(r, 'inputs.source_id') === report._id);
      return Utils.isFormSubmittedInWindow(
        relevantReports,
        'sampling_follow_up',
        Utils.addDate(dueDate, -event.start).getTime(),
        Utils.addDate(dueDate, event.end + 1).getTime()
      );
    },
    events: [{
      days: 0,
      start: 0,
      end: 25550
    }],
    actions: [{
      type: 'report',
      form: 'sampling_follow_up',
      label: 'task.sampling-follow-up.title',
      modifyContent: completeEditableContent
    }]
  }

// 3. Outcome Follow up
  {
    name: 'outcome-follow-up',
    icon: 'icon_issue',
    title: 'task.outcome-follow-up.title',
    appliesTo: 'reports',
    appliesToType: ['covid_symptoms_followup'],
    contactLabel: descriptiveContactLabel,
    appliesIf: (contact, report) => {
      return Utils.getField(report, 'g_results.results') === 'positive' && userHasParent('investigator');
    },
    resolvedIf: (contact, report, event, dueDate) => {
      const relevantReports = contact.reports.filter(r => Utils.getField(r, 'inputs.source_id') === report._id);
      return Utils.isFormSubmittedInWindow(
        relevantReports,
        'exit',
        Utils.addDate(dueDate, -event.start).getTime(),
        Utils.addDate(dueDate, event.end + 1).getTime()
      );
    },
    events: [{
      days: 10,
      start: 0,
      end: 25550
    }],
    actions: [{
      type: 'report',
      form: 'outcome',
      label: 'task.outcome-follow-up.title',
      modifyContent : (content, contact, report) => {
        content.g_details = report.fields.inputs.g_details;
        return content;
      }
    }]
  }
  ];
