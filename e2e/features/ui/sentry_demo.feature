Feature: Sentry demo

  Scenario: Demo can trigger the archived status frontend crash
    Given I go to the home page
    And I sign in as "admin"
    And I click enter your suggestion
    And I type "Sentry demo archived status crash trigger post" as the description
    And I click submit your feedback
    Then I should be on the show post page
    And I click respond
    And I choose "archived" as the response status
    And I submit the response modal
    Then I should see the error page
